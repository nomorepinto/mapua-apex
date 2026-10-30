"""Grant the backend Lambda permission to assign Cognito accounts.

Reads the monorepo root .env, finds the Web Function's execution role, and
adds an inline policy for listing users and writing custom attributes and
group membership. Also creates custom:signatory_id and
custom:organization_id when the user pool does not define them, and prints
the pool's Post Confirmation trigger.
"""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.exceptions import BotoCoreError, ClientError

DEFAULT_FUNCTION_NAME = "mapua-apex-backend"
POLICY_NAME = "mapua-apex-backend-cognito-accounts"
COGNITO_ACTIONS = (
    "cognito-idp:ListUsers",
    "cognito-idp:ListGroups",
    "cognito-idp:AdminGetUser",
    "cognito-idp:AdminUpdateUserAttributes",
    "cognito-idp:AdminDeleteUserAttributes",
    "cognito-idp:AdminAddUserToGroup",
    "cognito-idp:AdminRemoveUserFromGroup",
)
CUSTOM_ATTRIBUTES = ("signatory_id", "organization_id")


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def find_env_file() -> Path:
    for directory in Path(__file__).resolve().parents:
        candidate = directory / ".env"
        if candidate.is_file():
            return candidate
    raise SystemExit("Could not find the repository root .env file.")


def lambda_web(
    method: str, path: str, region: str, body: dict[str, Any] | None = None
) -> dict[str, Any]:
    url = f"https://lambda.{region}.amazonaws.com{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"} if data is not None else {}
    credentials = boto3.Session().get_credentials()
    if credentials is None:
        raise SystemExit(
            "No AWS credentials found. Configure the AWS CLI, then run this again."
        )
    request = AWSRequest(method=method, url=url, data=data, headers=headers)
    SigV4Auth(credentials.get_frozen_credentials(), "lambda", region).add_auth(request)
    prepared = request.prepare()
    outgoing = urllib.request.Request(
        url, data=data, headers=dict(prepared.headers), method=method
    )
    try:
        with urllib.request.urlopen(outgoing) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(
            f"Lambda Web API {method} {path} returned {error.code}: {detail}"
        ) from error
    return json.loads(payload) if payload else {}


def current_revision(function_name: str, region: str) -> dict[str, Any]:
    listed = lambda_web(
        "POST",
        f"/2025-03-07/web-functions/{function_name}/list-endpoints",
        region,
        {"maxResults": 20},
    )
    endpoints = listed.get("endpoints") or []
    match = next(
        (item for item in endpoints if item.get("endpointName") == function_name),
        None,
    )
    chosen = match or (endpoints[0] if endpoints else None)
    if chosen is None:
        raise SystemExit(f"{function_name} has no endpoint.")
    weights = chosen.get("revisionWeights") or []
    revision_id = weights[0].get("revisionId") if weights else None
    if not revision_id:
        raise SystemExit(f"Endpoint {chosen.get('endpointName')} has no revision.")
    return lambda_web(
        "GET",
        f"/2025-03-07/web-functions/{function_name}/revisions/{revision_id}",
        region,
    )


def role_name_from_arn(role_arn: str) -> str:
    marker = ":role/"
    if marker not in role_arn:
        raise SystemExit(f"Execution role ARN is not an IAM role: {role_arn}")
    return role_arn.split(marker, 1)[1].split("/")[-1]


def ensure_policy(
    iam: Any, role_arn: str, pool_arn: str, *, dry_run: bool
) -> None:
    role_name = role_name_from_arn(role_arn)
    document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AssignCognitoAccounts",
                "Effect": "Allow",
                "Action": list(COGNITO_ACTIONS),
                "Resource": pool_arn,
            }
        ],
    }
    if dry_run:
        print(f"Would put inline policy {POLICY_NAME} on role {role_name}.")
        return
    iam.put_role_policy(
        RoleName=role_name,
        PolicyName=POLICY_NAME,
        PolicyDocument=json.dumps(document),
    )
    print(f"Inline policy {POLICY_NAME} is on role {role_name}.")


def ensure_attributes(cognito: Any, user_pool_id: str, *, dry_run: bool) -> None:
    pool = cognito.describe_user_pool(UserPoolId=user_pool_id)["UserPool"]
    defined = {
        attribute.get("Name") for attribute in pool.get("SchemaAttributes", [])
    }
    missing = [
        name
        for name in CUSTOM_ATTRIBUTES
        if f"custom:{name}" not in defined
    ]
    trigger = (pool.get("LambdaConfig") or {}).get("PostConfirmation")
    print(
        "Post Confirmation trigger: "
        + (trigger if trigger else "(none)")
    )
    if not missing:
        print("User pool already defines custom:signatory_id and custom:organization_id.")
        return
    if dry_run:
        print(
            "Would add custom attributes: "
            + ", ".join(f"custom:{name}" for name in missing)
        )
        return
    cognito.add_custom_attributes(
        UserPoolId=user_pool_id,
        CustomAttributes=[
            {
                "Name": name,
                "AttributeDataType": "String",
                "Mutable": True,
                "StringAttributeConstraints": {"MaxLength": "128"},
            }
            for name in missing
        ],
    )
    print(
        "Added custom attributes: " + ", ".join(f"custom:{name}" for name in missing)
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--function-name", default=DEFAULT_FUNCTION_NAME)
    parser.add_argument(
        "--region",
        help="Region of the Web Function and user pool. Defaults to AWS_DEFAULT_REGION.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the role, policy, and attributes that would change.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = load_env_file(find_env_file())
    region = (
        args.region
        or source.get("AWS_COGNITO_REGION")
        or source.get("AWS_DEFAULT_REGION")
        or source.get("AWS_REGION")
        or "us-east-1"
    )
    user_pool_id = source.get("AWS_COGNITO_USER_POOL_ID", "")
    if not user_pool_id:
        raise SystemExit("AWS_COGNITO_USER_POOL_ID is empty in .env.")

    try:
        revision = current_revision(args.function_name, region)
        role_arn = str((revision.get("serviceConfig") or {}).get("executionRoleArn") or "")
        if not role_arn:
            raise SystemExit("The current revision has no execution role.")
        account_id = boto3.client("sts", region_name=region).get_caller_identity()["Account"]
        pool_arn = f"arn:aws:cognito-idp:{region}:{account_id}:userpool/{user_pool_id}"
        print(f"Function: {args.function_name}")
        print(f"Execution role: {role_arn}")
        print(f"User pool: {pool_arn}")
        session = boto3.Session(region_name=region)
        ensure_policy(
            session.client("iam"),
            role_arn,
            pool_arn,
            dry_run=args.dry_run,
        )
        ensure_attributes(
            session.client("cognito-idp"),
            user_pool_id,
            dry_run=args.dry_run,
        )
    except (BotoCoreError, ClientError, OSError) as error:
        print(f"Failed: {error}")
        return 1
    print("Dry run complete." if args.dry_run else "Cognito account permissions are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
