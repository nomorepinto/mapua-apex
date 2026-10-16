"""Deploy and connect the organization-assignment Cognito trigger.

The script reads the monorepo root `.env`, creates or updates the Lambda and
its IAM role, ensures the Cognito group exists, enables the organization
attribute on the app client, and configures the User Pool Post Confirmation
trigger.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

LAMBDA_HANDLER = "lambda_function.lambda_handler"
LAMBDA_RUNTIME = "python3.12"
ORGANIZATION_ATTRIBUTE = "custom:organization_id"
PERMISSION_STATEMENT_ID = "AllowCognitoPostConfirmation"

UPDATABLE_CLIENT_FIELDS = (
    "ClientName",
    "RefreshTokenValidity",
    "AccessTokenValidity",
    "IdTokenValidity",
    "TokenValidityUnits",
    "ReadAttributes",
    "WriteAttributes",
    "ExplicitAuthFlows",
    "SupportedIdentityProviders",
    "CallbackURLs",
    "LogoutURLs",
    "DefaultRedirectURI",
    "AllowedOAuthFlows",
    "AllowedOAuthScopes",
    "AllowedOAuthFlowsUserPoolClient",
    "AnalyticsConfiguration",
    "PreventUserExistenceErrors",
    "EnableTokenRevocation",
    "EnablePropagateAdditionalUserContextData",
    "AuthSessionValidity",
    "RefreshTokenRotation",
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
    "AWS_COGNITO_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "")),
)
USER_POOL_ID = os.environ.get("AWS_COGNITO_USER_POOL_ID", "")
CLIENT_ID = os.environ.get("AWS_COGNITO_CLIENT_ID", "")
TABLE_NAME = os.environ.get("AWS_DYNAMODB_TABLE", "")
FUNCTION_NAME = os.environ.get(
    "AWS_ORG_ASSIGN_LAMBDA_NAME", "mapua-apex-orgassign"
)
ROLE_NAME = os.environ.get(
    "AWS_ORG_ASSIGN_LAMBDA_ROLE_NAME", f"{FUNCTION_NAME}-role"
)
GROUP_NAME = os.environ.get("ORG_SUBMITTER_GROUP", "org_submitter")
SOURCE_FILE = (
    Path(__file__).resolve().parents[3]
    / "mapua-apex-orgassign-lambda"
    / "lambda_function.py"
)


def required_config() -> None:
    missing = [
        name
        for name, value in (
            ("AWS_DEFAULT_REGION", REGION),
            ("AWS_COGNITO_USER_POOL_ID", USER_POOL_ID),
            ("AWS_COGNITO_CLIENT_ID", CLIENT_ID),
            ("AWS_DYNAMODB_TABLE", TABLE_NAME),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing required .env values: {', '.join(missing)}")
    if not SOURCE_FILE.is_file():
        raise RuntimeError(f"Lambda source file not found: {SOURCE_FILE}")


def lambda_zip() -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        bundle.write(SOURCE_FILE, "lambda_function.py")
    return archive.getvalue()


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
    permissions = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "WriteLambdaLogs",
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                "Resource": f"arn:aws:logs:{REGION}:{account_id}:*",
            },
            {
                "Sid": "ReadOrganizations",
                "Effect": "Allow",
                "Action": "dynamodb:GetItem",
                "Resource": (
                    f"arn:aws:dynamodb:{REGION}:{account_id}:table/{TABLE_NAME}"
                ),
            },
            {
                "Sid": "ProvisionConfirmedUser",
                "Effect": "Allow",
                "Action": [
                    "cognito-idp:AdminUpdateUserAttributes",
                    "cognito-idp:AdminAddUserToGroup",
                ],
                "Resource": (
                    f"arn:aws:cognito-idp:{REGION}:{account_id}:userpool/"
                    f"{USER_POOL_ID}"
                ),
            },
        ],
    }

    if dry_run:
        print(f"Would create/update IAM role: {ROLE_NAME}")
        return role_arn

    try:
        role = iam.get_role(RoleName=ROLE_NAME)["Role"]
        iam.update_assume_role_policy(
            RoleName=ROLE_NAME,
            PolicyDocument=json.dumps(trust_policy),
        )
        role_arn = role["Arn"]
    except ClientError as error:
        if error.response["Error"]["Code"] != "NoSuchEntity":
            raise
        role_arn = iam.create_role(
            RoleName=ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
            Description="Execution role for the Mapua APEX Cognito org assignment trigger.",
        )["Role"]["Arn"]

    iam.put_role_policy(
        RoleName=ROLE_NAME,
        PolicyName=f"{FUNCTION_NAME}-permissions",
        PolicyDocument=json.dumps(permissions),
    )
    print(f"IAM role ready: {ROLE_NAME}")
    return role_arn


def wait_for_function(lambda_client: Any) -> None:
    lambda_client.get_waiter("function_updated_v2").wait(
        FunctionName=FUNCTION_NAME,
        WaiterConfig={"Delay": 2, "MaxAttempts": 30},
    )


def deploy_lambda(lambda_client: Any, role_arn: str, *, dry_run: bool) -> str:
    if dry_run:
        print(f"Would create/update Lambda: {FUNCTION_NAME}")
        return f"arn:aws:lambda:{REGION}:000000000000:function:{FUNCTION_NAME}"

    payload = lambda_zip()
    try:
        current = lambda_client.get_function(FunctionName=FUNCTION_NAME)
    except ClientError as error:
        if error.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

        for attempt in range(12):
            try:
                created = lambda_client.create_function(
                    FunctionName=FUNCTION_NAME,
                    Runtime=LAMBDA_RUNTIME,
                    Role=role_arn,
                    Handler=LAMBDA_HANDLER,
                    Code={"ZipFile": payload},
                    Description=(
                        "Validates a selected organization and provisions "
                        "confirmed Cognito users."
                    ),
                    Timeout=30,
                    MemorySize=128,
                    Environment={
                        "Variables": {
                            "DYNAMODB_TABLE_NAME": TABLE_NAME,
                            "ORG_SUBMITTER_GROUP": GROUP_NAME,
                        }
                    },
                    Publish=True,
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

    lambda_client.update_function_code(
        FunctionName=FUNCTION_NAME,
        ZipFile=payload,
        Publish=True,
    )
    wait_for_function(lambda_client)
    lambda_client.update_function_configuration(
        FunctionName=FUNCTION_NAME,
        Runtime=LAMBDA_RUNTIME,
        Role=role_arn,
        Handler=LAMBDA_HANDLER,
        Description=(
            "Validates a selected organization and provisions confirmed Cognito users."
        ),
        Timeout=30,
        MemorySize=128,
        Environment={
            "Variables": {
                "DYNAMODB_TABLE_NAME": TABLE_NAME,
                "ORG_SUBMITTER_GROUP": GROUP_NAME,
            }
        },
    )
    wait_for_function(lambda_client)
    function_arn = current["Configuration"]["FunctionArn"]
    print(f"Lambda updated: {FUNCTION_NAME}")
    return function_arn


def ensure_group(cognito: Any, *, dry_run: bool) -> None:
    try:
        cognito.get_group(GroupName=GROUP_NAME, UserPoolId=USER_POOL_ID)
        print(f"Cognito group already exists: {GROUP_NAME}")
    except ClientError as error:
        if error.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        if dry_run:
            print(f"Would create Cognito group: {GROUP_NAME}")
            return
        cognito.create_group(
            GroupName=GROUP_NAME,
            UserPoolId=USER_POOL_ID,
            Description="Organization submitters provisioned after signup.",
        )
        print(f"Cognito group created: {GROUP_NAME}")


def ensure_organization_attribute(cognito: Any, *, dry_run: bool) -> None:
    pool = cognito.describe_user_pool(UserPoolId=USER_POOL_ID)["UserPool"]
    attribute_names = {
        attribute.get("Name") for attribute in pool.get("SchemaAttributes", [])
    }
    if ORGANIZATION_ATTRIBUTE in attribute_names:
        print(f"User Pool already defines {ORGANIZATION_ATTRIBUTE}")
        return

    if dry_run:
        print(f"Would create User Pool attribute: {ORGANIZATION_ATTRIBUTE}")
        return

    cognito.add_custom_attributes(
        UserPoolId=USER_POOL_ID,
        CustomAttributes=[
            {
                "Name": "organization_id",
                "AttributeDataType": "String",
                "Mutable": True,
                "StringAttributeConstraints": {"MaxLength": "128"},
            }
        ],
    )
    print(f"User Pool attribute created: {ORGANIZATION_ATTRIBUTE}")


def ensure_client_attributes(cognito: Any, *, dry_run: bool) -> None:
    client = cognito.describe_user_pool_client(
        UserPoolId=USER_POOL_ID,
        ClientId=CLIENT_ID,
    )["UserPoolClient"]
    read_attributes = list(client.get("ReadAttributes", []))
    write_attributes = list(client.get("WriteAttributes", []))
    changed = False

    for attributes in (read_attributes, write_attributes):
        if ORGANIZATION_ATTRIBUTE not in attributes:
            attributes.append(ORGANIZATION_ATTRIBUTE)
            changed = True

    if not changed:
        print(f"App client already allows {ORGANIZATION_ATTRIBUTE}")
        return

    request: dict[str, Any] = {
        "UserPoolId": USER_POOL_ID,
        "ClientId": CLIENT_ID,
    }
    for field in UPDATABLE_CLIENT_FIELDS:
        if field in client:
            request[field] = client[field]
    request["ReadAttributes"] = read_attributes
    request["WriteAttributes"] = write_attributes

    if dry_run:
        print(f"Would allow {ORGANIZATION_ATTRIBUTE} on app client {CLIENT_ID}")
        return

    cognito.update_user_pool_client(**request)
    print(f"App client now allows {ORGANIZATION_ATTRIBUTE}")


def connect_trigger(
    lambda_client: Any,
    cognito: Any,
    function_arn: str,
    account_id: str,
    *,
    dry_run: bool,
) -> None:
    pool_arn = f"arn:aws:cognito-idp:{REGION}:{account_id}:userpool/{USER_POOL_ID}"
    if dry_run:
        print(f"Would attach {FUNCTION_NAME} as the Post Confirmation trigger.")
        return

    try:
        lambda_client.remove_permission(
            FunctionName=FUNCTION_NAME,
            StatementId=PERMISSION_STATEMENT_ID,
        )
    except ClientError as error:
        if error.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    lambda_client.add_permission(
        FunctionName=FUNCTION_NAME,
        StatementId=PERMISSION_STATEMENT_ID,
        Action="lambda:InvokeFunction",
        Principal="cognito-idp.amazonaws.com",
        SourceArn=pool_arn,
        SourceAccount=account_id,
    )

    pool = cognito.describe_user_pool(UserPoolId=USER_POOL_ID)["UserPool"]
    lambda_config = dict(pool.get("LambdaConfig", {}))
    lambda_config["PostConfirmation"] = function_arn
    cognito.update_user_pool(
        UserPoolId=USER_POOL_ID,
        LambdaConfig=lambda_config,
    )
    print(f"Post Confirmation trigger attached to {USER_POOL_ID}")


def deploy(*, dry_run: bool = False) -> None:
    required_config()
    session = boto3.Session(region_name=REGION)
    sts = session.client("sts")
    iam = session.client("iam")
    lambda_client = session.client("lambda")
    cognito = session.client("cognito-idp")
    account_id = sts.get_caller_identity()["Account"]

    print(f"Loaded environment: {ENV_PATH}")
    print(f"AWS account: {account_id}; region: {REGION}")
    print(f"User Pool: {USER_POOL_ID}; app client: {CLIENT_ID}")
    print(f"DynamoDB table: {TABLE_NAME}; group: {GROUP_NAME}")

    role_arn = ensure_role(iam, account_id, dry_run=dry_run)
    function_arn = deploy_lambda(lambda_client, role_arn, dry_run=dry_run)
    ensure_group(cognito, dry_run=dry_run)
    ensure_organization_attribute(cognito, dry_run=dry_run)
    ensure_client_attributes(cognito, dry_run=dry_run)
    connect_trigger(
        lambda_client,
        cognito,
        function_arn,
        account_id,
        dry_run=dry_run,
    )

    print("Dry run complete." if dry_run else "Organization signup trigger is ready.")


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
