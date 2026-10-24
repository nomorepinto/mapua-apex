"""Publish a Lambda Web Function revision whose environment matches the root .env.

The console has no control for environment variables on an existing revision.
This creates a new revision with the same code artifact and a new
environmentVariables map. The endpoint must use LatestRevision so the new
revision receives traffic.

Lambda rejects AWS_REGION, AWS_DEFAULT_REGION, AWS_ACCESS_KEY_ID,
AWS_SECRET_ACCESS_KEY, and AWS_LAMBDA_HTTP_ENDPOINT. Those keys are read for
the API call when needed and are not sent. APP_ENV values that mark the
process as local are sent as production unless --keep-app-env is set.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

DEFAULT_FUNCTION_NAME = "mapua-apex-backend"
LOCAL_APP_ENVS = {"local", "testing", "dev", "test"}

# Names Nest reads. Empty values are omitted. Reserved Lambda names are absent
# on purpose: sending them makes CreateWebFunctionRevision fail.
APP_KEYS = (
    "APP_ENV",
    "AWS_COGNITO_REGION",
    "AWS_COGNITO_USER_POOL_ID",
    "AWS_COGNITO_CLIENT_ID",
    "AWS_COGNITO_ENDPOINT",
    "AWS_DYNAMODB_REGION",
    "AWS_DYNAMODB_TABLE",
    "AWS_DYNAMODB_SESSION_LOG_TABLE",
    "AWS_DYNAMODB_ACTIVITY_LOG_TABLE",
    "LOG_RETENTION_DAYS",
    "AWS_ENDPOINT",
    "DYNAMODB_ENDPOINT",
    "AWS_SES_REGION",
    "MAIL_FROM_ADDRESS",
    "FRONTEND_URL",
    "CORS_ALLOWED_ORIGINS",
    "ORIGIN_VERIFY_SECRET",
    "ORIGIN_VERIFY_SECRET_PARAMETER",
    "ARCUS_SERVICE_TOKEN",
    "ARCUS_SERVICE_TOKEN_PARAMETER",
    "ARCUS_ATTENDANCE_URL",
    "ARCUS_EVALUATION_URL",
    "VITE_ARCUS_ATTENDANCE_URL",
    "VITE_ARCUS_EVALUATION_URL",
    "ARCUS_POST_EVALUATION_WINDOW_DAYS",
    "EMAILDETECTIVE_API_KEY",
    "EMAILDETECTIVE_API_KEY_PARAMETER",
    "EMAILDETECTIVE_BASE_URL",
    "GIBBERISH_CHECK_ENABLED",
    "GIBBERISH_API_URL",
    "GIBBERISH_API_KEY",
    "GIBBERISH_API_KEY_PARAMETER",
    "GIBBERISH_DETECTOR_VERSION",
    "GIBBERISH_CACHE_TTL",
    "VITE_ALLOW_ANY_EVENT_DATE",
)


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


def app_environment(source: dict[str, str], keep_app_env: bool) -> dict[str, str]:
    selected = {key: source[key] for key in APP_KEYS if source.get(key)}
    app_env = selected.get("APP_ENV", "")
    if app_env in LOCAL_APP_ENVS and not keep_app_env:
        print(
            f"APP_ENV is {app_env} in .env. Sending production so the deployed "
            "app does not take the local path. Pass --keep-app-env to copy it."
        )
        selected["APP_ENV"] = "production"
    return selected


def lambda_web(method: str, path: str, region: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"https://lambda.{region}.amazonaws.com{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"} if data is not None else {}
    credentials = boto3.Session().get_credentials()
    if credentials is None:
        raise SystemExit("No AWS credentials found. Configure the AWS CLI, then run this again.")
    request = AWSRequest(method=method, url=url, data=data, headers=headers)
    SigV4Auth(credentials.get_frozen_credentials(), "lambda", region).add_auth(request)
    prepared = request.prepare()
    outgoing = urllib.request.Request(url, data=data, headers=dict(prepared.headers), method=method)
    try:
        with urllib.request.urlopen(outgoing) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Lambda Web API {method} {path} returned {error.code}: {detail}") from error
    return json.loads(payload) if payload else {}


def current_revision_id(function_name: str, region: str) -> str:
    listed = lambda_web(
        "POST",
        f"/2025-03-07/web-functions/{function_name}/list-endpoints",
        region,
        {"maxResults": 20},
    )
    endpoints = listed.get("endpoints") or []
    match = next((item for item in endpoints if item.get("endpointName") == function_name), None)
    chosen = match or (endpoints[0] if endpoints else None)
    if chosen is None:
        raise SystemExit(f"{function_name} has no endpoint.")
    weights = chosen.get("revisionWeights") or []
    revision_id = weights[0].get("revisionId") if weights else None
    if not revision_id:
        raise SystemExit(f"Endpoint {chosen.get('endpointName')} has no revision.")
    return str(revision_id)


def without_nulls(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: without_nulls(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [without_nulls(item) for item in value]
    return value


def merged_service_config(current: dict[str, Any], variables: dict[str, str]) -> dict[str, Any]:
    service = without_nulls(current.get("serviceConfig") or {})
    existing = dict(service.get("environmentVariables") or {})
    for key in APP_KEYS:
        existing.pop(key, None)
    existing.update(variables)
    service["environmentVariables"] = existing
    if "executionRoleArn" not in service:
        raise SystemExit("The current revision has no execution role to copy.")
    return service


def wait_until_active(function_name: str, revision_id: str, region: str) -> None:
    path = f"/2025-03-07/web-functions/{function_name}/revisions/{revision_id}"
    for _ in range(60):
        revision = lambda_web("GET", path, region)
        state = revision.get("state")
        if state == "Active":
            print(f"Revision {revision_id} is Active.")
            return
        if state == "Failed":
            reason = revision.get("stateReason") or revision.get("errors")
            raise SystemExit(f"Revision {revision_id} failed: {reason}")
        time.sleep(3)
    raise SystemExit(f"Timed out waiting for revision {revision_id}.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--function-name", default=DEFAULT_FUNCTION_NAME)
    parser.add_argument(
        "--region",
        help="Region of the Web Function. Defaults to AWS_DEFAULT_REGION in .env.",
    )
    parser.add_argument(
        "--keep-app-env",
        action="store_true",
        help="Copy APP_ENV even when it is local, testing, dev, or test.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the variable names that would be sent. Values are not printed.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    env_path = find_env_file()
    source = load_env_file(env_path)
    variables = app_environment(source, args.keep_app_env)
    region = args.region or source.get("AWS_DEFAULT_REGION") or source.get("AWS_REGION") or "us-east-1"
    if not variables:
        raise SystemExit(f"No application variables with values were found in {env_path}.")

    print(f"From {env_path}, {len(variables)} variables will be set on {args.function_name} in {region}:")
    for key in sorted(variables):
        print(f"  {key}")

    if args.dry_run:
        return

    revision_id = current_revision_id(args.function_name, region)
    current = lambda_web(
        "GET",
        f"/2025-03-07/web-functions/{args.function_name}/revisions/{revision_id}",
        region,
    )
    build_config = without_nulls(current.get("buildConfig") or {})
    if "codeConfig" not in build_config or "runtimeConfig" not in build_config:
        raise SystemExit("The current revision has no code artifact to reuse.")

    created = lambda_web(
        "POST",
        f"/2025-03-07/web-functions/{args.function_name}/revisions",
        region,
        {
            "buildConfig": build_config,
            "serviceConfig": merged_service_config(current, variables),
        },
    )
    new_id = str(created.get("revisionId") or "")
    if not new_id:
        raise SystemExit(f"Create revision did not return a revision id: {created}")
    print(f"Created revision {new_id} from the code of {revision_id}.")
    wait_until_active(args.function_name, new_id, region)


if __name__ == "__main__":
    main()
