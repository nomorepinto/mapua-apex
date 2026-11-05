"""Deploy the TTL auto-cancel DynamoDB Streams consumer.

The script reads the monorepo root `.env`, enables DynamoDB Streams (KEYS_ONLY)
and the `TTL` attribute on the shared table (both expected already-on), creates
or updates the consumer Lambda and its IAM role, and wires the stream event
source mapping with a `CANCELWATCH#` REMOVE filter.

The consumer boots the full Nest DI graph, so it ships as a tsc build plus
production `node_modules` (esbuild drops the `emitDecoratorMetadata` Nest needs
to resolve constructor injection). Package the code first:
`cd ../mapua-apex-backend-nest && npm run build`.

Run `python scripts/deploy_cancelwatch_lambda.py --dry-run` to preview the
changes without touching AWS.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

LAMBDA_HANDLER = "dist/stream-lambda.handler"
LAMBDA_RUNTIME = "nodejs22.x"
STREAM_VIEW_TYPE = "KEYS_ONLY"
TTL_ATTRIBUTE = "TTL"
BASIC_EXECUTION_POLICY = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

# Secret keys that AppConfigService loads from SSM at startup when the matching
# *_PARAMETER is set. The consumer boots the full graph, so copy any configured
# parameter name and grant ssm:GetParameter on it; otherwise startup skips SSM.
SSM_PARAMETER_KEYS = (
    "ARCUS_SERVICE_TOKEN_PARAMETER",
    "EMAILDETECTIVE_API_KEY_PARAMETER",
    "GIBBERISH_API_KEY_PARAMETER",
    "ORIGIN_VERIFY_SECRET_PARAMETER",
)

# Environment variables forwarded verbatim from the root .env to the Lambda.
# AWS_DEFAULT_REGION / AWS_REGION are intentionally omitted: Lambda rejects them
# as reserved keys, but the runtime already injects AWS_REGION with the function
# region, so AppConfigService.region() still resolves. The non-reserved
# AWS_SES_REGION / AWS_DYNAMODB_REGION overrides are forwarded when present.
FORWARDED_ENV_KEYS = (
    "AWS_DYNAMODB_TABLE",
    "AWS_SES_REGION",
    "AWS_DYNAMODB_REGION",
    "MAIL_FROM_ADDRESS",
    "ARCUS_POST_EVALUATION_WINDOW_DAYS",
    "ARCUS_AUTO_CANCEL_ENABLED",
    "AWS_ENDPOINT",
    "DYNAMODB_ENDPOINT",
)


def load_project_env() -> Path:
    current = Path(__file__).resolve().parent
    for directory in (current, *current.parents):
        env_path = directory / ".env"
        if not env_path.is_file():
            continue

        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ.setdefault(key, value)
        return env_path

    raise RuntimeError("Could not find the project .env file.")


ENV_PATH = load_project_env()
REGION = os.environ.get(
    "AWS_DEFAULT_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "")),
)
SES_REGION = os.environ.get("AWS_SES_REGION", REGION)
TABLE_NAME = os.environ.get("AWS_DYNAMODB_TABLE", "")
FUNCTION_NAME = os.environ.get(
    "AWS_CANCELWATCH_LAMBDA_NAME", "mapua-apex-cancelwatch"
)
ROLE_NAME = os.environ.get(
    "AWS_CANCELWATCH_LAMBDA_ROLE_NAME", f"{FUNCTION_NAME}-role"
)
BACKEND_DIR = Path(__file__).resolve().parents[2] / "mapua-apex-backend-nest"
DIST_DIR = BACKEND_DIR / "dist"
STREAM_ENTRY = DIST_DIR / "stream-lambda.js"


def required_config() -> None:
    missing = [
        name
        for name, value in (
            ("AWS_DEFAULT_REGION", REGION),
            ("AWS_DYNAMODB_TABLE", TABLE_NAME),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing required .env values: {', '.join(missing)}")
    if not STREAM_ENTRY.is_file():
        raise RuntimeError(
            f"tsc build output not found: {STREAM_ENTRY}\n"
            "Build the server first:  cd ../mapua-apex-backend-nest && npm run build"
        )
    if not (BACKEND_DIR / "package.json").is_file() or not (
        BACKEND_DIR / "package-lock.json"
    ).is_file():
        raise RuntimeError(
            "The backend package.json and package-lock.json are required to "
            "stage the production dependencies."
        )


def table_arn(account_id: str) -> str:
    return f"arn:aws:dynamodb:{REGION}:{account_id}:table/{TABLE_NAME}"


def stream_arn_filter(account_id: str) -> str:
    # Wildcard the stream suffix so the grant survives a stream re-creation.
    return f"arn:aws:dynamodb:{REGION}:{account_id}:table/{TABLE_NAME}/stream/*"


def add_tree(bundle: zipfile.ZipFile, root: Path, prefix: str) -> None:
    for path in sorted(root.rglob("*")):
        if path.is_file():
            bundle.write(path, f"{prefix}/{path.relative_to(root).as_posix()}")


def stage_prod_modules() -> Path:
    # A clean, production-only install into an isolated temp dir so the Lambda
    # zip carries runtime dependencies without touching the developer tree.
    staging = Path(tempfile.mkdtemp(prefix="cancelwatch-deps-"))
    shutil.copy2(BACKEND_DIR / "package.json", staging / "package.json")
    shutil.copy2(BACKEND_DIR / "package-lock.json", staging / "package-lock.json")
    command = f'npm ci --omit=dev --prefix "{staging}"'
    try:
        subprocess.run(command, shell=True, check=True, cwd=str(BACKEND_DIR))
    except subprocess.CalledProcessError as error:
        shutil.rmtree(staging, ignore_errors=True)
        raise RuntimeError(
            f"Production dependency install failed ({command})."
        ) from error
    prod_modules = staging / "node_modules"
    if not prod_modules.is_dir():
        shutil.rmtree(staging, ignore_errors=True)
        raise RuntimeError("npm ci did not produce a node_modules tree.")
    return staging


def bundle_zip() -> bytes:
    # Mirror the Web Function package: package.json (type module) + the tsc dist
    # build + its production node_modules. Handler is dist/stream-lambda.handler.
    staging = stage_prod_modules()
    try:
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
            bundle.write(BACKEND_DIR / "package.json", "package.json")
            add_tree(bundle, DIST_DIR, "dist")
            add_tree(bundle, staging / "node_modules", "node_modules")
        return archive.getvalue()
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def lambda_env() -> dict[str, str]:
    variables: dict[str, str] = {}
    for key in FORWARDED_ENV_KEYS:
        value = os.environ.get(key)
        if value:
            variables[key] = value
    for key in SSM_PARAMETER_KEYS:
        value = os.environ.get(key)
        if value:
            variables[key] = value
    return variables


def enable_streams(dynamo: Any, *, dry_run: bool) -> str:
    describe = dynamo.describe_table(TableName=TABLE_NAME)["Table"]
    spec = describe.get("StreamSpecification", {})
    if spec.get("StreamEnabled") and spec.get("StreamViewType") == STREAM_VIEW_TYPE:
        stream_arn = describe.get("LatestStreamArn", "")
        print(f"DynamoDB Streams already enabled ({STREAM_VIEW_TYPE}): {stream_arn}")
        return stream_arn

    if dry_run:
        print(f"Would enable DynamoDB Streams on {TABLE_NAME} ({STREAM_VIEW_TYPE})")
        return describe.get("LatestStreamArn", "")

    dynamo.update_table(
        TableName=TABLE_NAME,
        StreamSpecification={"StreamEnabled": True, "StreamViewType": STREAM_VIEW_TYPE},
    )
    dynamo.get_waiter("table_exists").wait(
        TableName=TABLE_NAME, WaiterConfig={"Delay": 2, "MaxAttempts": 60}
    )
    for _ in range(30):
        stream_arn = dynamo.describe_table(TableName=TABLE_NAME)["Table"].get(
            "LatestStreamArn", ""
        )
        if stream_arn:
            print(f"DynamoDB Streams enabled: {stream_arn}")
            return stream_arn
        time.sleep(2)
    raise RuntimeError("DynamoDB stream ARN did not become available in time.")


def ensure_ttl(dynamo: Any, *, dry_run: bool) -> None:
    status = dynamo.describe_time_to_live(TableName=TABLE_NAME)[
        "TimeToLiveDescription"
    ]
    if (
        status.get("TimeToLiveStatus") == "ENABLED"
        and status.get("AttributeName") == TTL_ATTRIBUTE
    ):
        print(f"TTL already enabled on attribute {TTL_ATTRIBUTE}")
        return

    if dry_run:
        print(f"Would enable TTL on attribute {TTL_ATTRIBUTE} for {TABLE_NAME}")
        return

    dynamo.update_time_to_live(
        TableName=TABLE_NAME,
        TimeToLiveSpecification={"AttributeName": TTL_ATTRIBUTE, "Enabled": True},
    )
    for _ in range(30):
        current = dynamo.describe_time_to_live(TableName=TABLE_NAME)[
            "TimeToLiveDescription"
        ]
        if current.get("TimeToLiveStatus") in {"ENABLED", "ENABLING"}:
            print(f"TTL enabled on attribute {TTL_ATTRIBUTE}")
            return
        time.sleep(2)
    raise RuntimeError("DynamoDB TTL did not activate within 60 seconds.")


def ensure_role(iam: Any, account_id: str, *, dry_run: bool) -> str:
    role_arn = f"arn:aws:iam::{account_id}:role/{ROLE_NAME}"
    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "lambda.amazonaws.com"},
                "Action": "sts:AssumeRole",
            }
        ],
    }

    statements: list[dict[str, Any]] = [
        {
            "Sid": "ReadDynamoDBStream",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetShardIterator",
                "dynamodb:DescribeStream",
                "dynamodb:GetRecords",
                "dynamodb:ListStreams",
            ],
            "Resource": [stream_arn_filter(account_id), table_arn(account_id)],
        },
        {
            "Sid": "ReadAndCancelSubmissions",
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
                "dynamodb:PutItem",
                "dynamodb:DeleteItem",
            ],
            "Resource": table_arn(account_id),
        },
        {
            "Sid": "SendDecisionEmails",
            "Effect": "Allow",
            "Action": ["ses:SendEmail", "ses:SendRawEmail"],
            "Resource": (
                f"arn:aws:ses:{SES_REGION}:{account_id}:identity/*"
            ),
        },
    ]

    parameter_names = [
        os.environ[key]
        for key in SSM_PARAMETER_KEYS
        if os.environ.get(key)
    ]
    if parameter_names:
        arns = [
            f"arn:aws:ssm:{REGION}:{account_id}:parameter/{name.lstrip('/')}"
            for name in parameter_names
        ]
        statements.append(
            {
                "Sid": "ReadStartupSecrets",
                "Effect": "Allow",
                "Action": "ssm:GetParameter",
                "Resource": arns,
            }
        )

    permissions = {"Version": "2012-10-17", "Statement": statements}

    if dry_run:
        print(f"Would create/update IAM role: {ROLE_NAME}")
        return role_arn

    try:
        role = iam.get_role(RoleName=ROLE_NAME)["Role"]
        iam.update_assume_role_policy(
            RoleName=ROLE_NAME, PolicyDocument=json.dumps(trust_policy)
        )
        role_arn = role["Arn"]
    except ClientError as error:
        if error.response["Error"]["Code"] != "NoSuchEntity":
            raise
        role_arn = iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
            Description="Execution role for the Mapua APEX auto-cancel stream consumer.",
        )["Role"]["Arn"]

    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName=f"{FUNCTION_NAME}-permissions",
        PolicyDocument=json.dumps(permissions),
    )
    try:
        iam.attach_role_policy(RoleName=ROLE_NAME, PolicyArn=BASIC_EXECUTION_POLICY)
    except ClientError as error:
        if error.response["Error"]["Code"] != "ConflictException":
            raise
    print(f"IAM role ready: {ROLE_NAME}")
    return role_arn


def wait_for_function(lambda_client: Any) -> None:
    lambda_client.get_waiter("function_updated_v2").wait(
        FunctionName=FUNCTION_NAME, WaiterConfig={"Delay": 2, "MaxAttempts": 30}
    )


def deploy_lambda(lambda_client: Any, role_arn: str, *, dry_run: bool) -> str:
    variables = lambda_env()
    if dry_run:
        print(f"Would create/update Lambda: {FUNCTION_NAME}")
        return f"arn:aws:lambda:{REGION}:000000000000:function:{FUNCTION_NAME}"

    payload = bundle_zip()
    common: dict[str, Any] = {
        "Runtime": LAMBDA_RUNTIME,
        "Role": role_arn,
        "Handler": LAMBDA_HANDLER,
        "Description": (
            "Consumes CANCELWATCH# TTL expiries and auto-cancels submissions "
            "whose post-evaluation window lapsed with nothing filed."
        ),
        "Timeout": 60,
        "MemorySize": 512,
        "Environment": {"Variables": variables},
    }

    try:
        existing = lambda_client.get_function(FunctionName=FUNCTION_NAME)
    except ClientError as error:
        if error.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

        for attempt in range(12):
            try:
                created = lambda_client.create_function(
                    FunctionName=FUNCTION_NAME,
                    Code={"ZipFile": payload},
                    **common,
                )
                wait_for_function(lambda_client)
                print(f"Lambda created: {FUNCTION_NAME}")
                return created["FunctionArn"]
            except ClientError as create_error:
                code = create_error.response["Error"]["Code"]
                if code != "InvalidParameterValueException" or attempt == 11:
                    raise
                time.sleep(5)
        raise RuntimeError("Lambda creation retry loop ended unexpectedly.")

    function_arn = existing["Configuration"]["FunctionArn"]
    lambda_client.update_function_code(
        FunctionName=FUNCTION_NAME, ZipFile=payload
    )
    wait_for_function(lambda_client)
    lambda_client.update_function_configuration(
        FunctionName=FUNCTION_NAME, **common
    )
    wait_for_function(lambda_client)
    print(f"Lambda updated: {FUNCTION_NAME}")
    return function_arn


def filter_criteria() -> dict[str, Any]:
    return {
        "Filters": [
            {
                "Pattern": json.dumps(
                    {
                        "eventName": ["REMOVE"],
                        "dynamodb": {
                            "Keys": {"SK": {"S": [{"prefix": "CANCELWATCH#"}]}}
                        },
                    }
                )
            }
        ]
    }


def ensure_event_source_mapping(
    lambda_client: Any, stream_arn: str, function_arn: str, *, dry_run: bool
) -> None:
    if not stream_arn:
        raise RuntimeError("No stream ARN available to attach the consumer to.")

    mapping_state = {
        "StartingPosition": "LATEST",
        "BatchSize": 10,
        "MaximumBatchingWindowInSeconds": 5,
        "MaximumRetryAttempts": 3,
        "BisectBatchOnFunctionError": True,
        "FunctionResponseTypes": ["ReportBatchItemFailures"],
        "FilterCriteria": filter_criteria(),
    }

    existing_uuid = None
    paginator = lambda_client.get_paginator("list_event_source_mappings")
    for page in paginator.paginate(FunctionName=FUNCTION_NAME):
        for mapping in page.get("EventSourceMappings", []):
            if mapping.get("EventSourceArn") == stream_arn:
                existing_uuid = mapping["UUID"]
                break
        if existing_uuid:
            break

    if dry_run:
        action = "update" if existing_uuid else "create"
        print(f"Would {action} the stream event source mapping for {FUNCTION_NAME}")
        return

    if existing_uuid:
        update_state = dict(mapping_state)
        # StartingPosition is create-only; drop it from the update request.
        update_state.pop("StartingPosition", None)
        lambda_client.update_event_source_mapping(UUID=existing_uuid, **update_state)
        print(f"Event source mapping updated: {existing_uuid}")
    else:
        created = lambda_client.create_event_source_mapping(
            FunctionName=FUNCTION_NAME,
            EventSourceArn=stream_arn,
            **mapping_state,
        )
        print(f"Event source mapping created: {created['UUID']}")


def deploy(*, dry_run: bool = False) -> None:
    required_config()
    session = boto3.Session(region_name=REGION)
    sts = session.client("sts")
    iam = session.client("iam")
    dynamo = session.client("dynamodb")
    lambda_client = session.client("lambda")
    account_id = sts.get_caller_identity()["Account"]

    print(f"Loaded environment: {ENV_PATH}")
    print(f"AWS account: {account_id}; region: {REGION}")
    print(f"DynamoDB table: {TABLE_NAME}; function: {FUNCTION_NAME}")

    stream_arn = enable_streams(dynamo, dry_run=dry_run)
    ensure_ttl(dynamo, dry_run=dry_run)
    role_arn = ensure_role(iam, account_id, dry_run=dry_run)
    function_arn = deploy_lambda(lambda_client, role_arn, dry_run=dry_run)
    ensure_event_source_mapping(
        lambda_client, stream_arn, function_arn, dry_run=dry_run
    )

    print(
        "Dry run complete."
        if dry_run
        else "Auto-cancel stream consumer is ready. Deploy the Web Function too."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show the resources that would be configured without changing AWS.",
    )
    args = parser.parse_args(argv)

    try:
        deploy(dry_run=args.dry_run)
    except (BotoCoreError, ClientError, OSError, RuntimeError) as error:
        print(f"Deployment failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
