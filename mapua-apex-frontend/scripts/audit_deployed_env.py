"""READ-ONLY audit: compare the root .env against deployed Lambda and Amplify settings.

Checks:
  1. mapua-apex-backend Web Function current revision  -> environmentVariables
  2. mapua-apex-cancelwatch (stream consumer) Lambda   -> Environment.Variables
  3. Amplify app mapua-apex-frontend branches          -> platform env vars
Values are masked (secrets show only length); key names are printed in full.

Usage: python scripts/audit_deployed_env.py [--region ap-southeast-1]
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

SECRET_HINTS = ("SECRET", "TOKEN", "KEY", "PASSWORD")
FRONTEND_HINTS = ("VITE_", "REACT_APP_")
BACKEND_KEYS = (
    "APP_ENV",
    "AWS_COGNITO_USER_POOL_ID",
    "AWS_COGNITO_CLIENT_ID",
    "AWS_DYNAMODB_TABLE",
    "AWS_DYNAMODB_SESSION_LOG_TABLE",
    "AWS_DYNAMODB_ACTIVITY_LOG_TABLE",
    "LOG_RETENTION_DAYS",
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
    "ARCUS_AUTO_CANCEL_ENABLED",
    "EMAILDETECTIVE_API_KEY",
    "EMAILDETECTIVE_API_KEY_PARAMETER",
    "EMAILDETECTIVE_BASE_URL",
    "GIBBERISH_CHECK_ENABLED",
    "GIBBERISH_API_URL",
    "GIBBERISH_API_KEY",
    "GIBBERISH_API_KEY_PARAMETER",
    "GIBBERISH_DETECTOR_VERSION",
    "GIBBERISH_CACHE_TTL",
)


def load_root_env() -> dict[str, str]:
    for directory in Path(__file__).resolve().parents:
        candidate = directory / ".env"
        if candidate.is_file():
            values: dict[str, str] = {}
            for raw in candidate.read_text(encoding="utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
            return values
    raise SystemExit("Root .env not found.")


def mask(key: str, value: str) -> str:
    if any(h in key.upper() for h in SECRET_HINTS) and len(value) > 0:
        return f"<set, {len(value)} chars>"
    return value


def show_vars(name: str, variables: dict[str, Any]) -> None:
    print(f"\n=== {name} ({len(variables)} vars) ===")
    for key in sorted(variables):
        print(f"  {key} = {mask(key, str(variables[key]))}")


def lambda_web(method: str, path: str, region: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    url = f"https://lambda.{region}.amazonaws.com{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"} if data is not None else {}
    creds = boto3.Session().get_credentials()
    request = AWSRequest(method=method, url=url, data=data, headers=headers)
    SigV4Auth(creds.get_frozen_credentials(), "lambda", region).add_auth(request)
    outgoing = urllib.request.Request(url, data=data, headers=dict(request.prepare().headers), method=method)
    try:
        with urllib.request.urlopen(outgoing) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        print(f"  !! Lambda Web API {method} {path} -> {error.code}: {error.read().decode('utf-8', 'replace')}")
        return {}
    return json.loads(payload) if payload else {}


def audit_web_function(region: str) -> dict[str, str]:
    fn = "mapua-apex-backend"
    listed = lambda_web("POST", f"/2025-03-07/web-functions/{fn}/list-endpoints", region, {"maxResults": 20})
    endpoints = listed.get("endpoints") or []
    if not endpoints:
        print(f"\n=== Web Function {fn}: NO ENDPOINTS FOUND ===")
        return {}
    weights = endpoints[0].get("revisionWeights") or []
    revision_id = weights[0].get("revisionId") if weights else None
    if not revision_id:
        print(f"\n=== Web Function {fn}: endpoint has no revision ===")
        return {}
    rev = lambda_web("GET", f"/2025-03-07/web-functions/{fn}/revisions/{revision_id}", region)
    service = rev.get("serviceConfig") or {}
    vars_ = service.get("environmentVariables") or {}
    runtime = (rev.get("buildConfig") or {}).get("runtimeConfig", {})
    print(f"\n=== Web Function {fn} (revision {revision_id}, state={rev.get('state')}, runtime={runtime.get('runtime')}, memory={service.get('memorySize')}, timeout={service.get('timeoutSeconds')}) ===")
    for key in sorted(vars_):
        print(f"  {key} = {mask(key, str(vars_[key]))}")
    return {k: str(v) for k, v in vars_.items()}


def audit_cancelwatch(region: str) -> dict[str, str]:
    lam = boto3.client("lambda", region_name=region)
    try:
        fn = lam.get_function_configuration(FunctionName="mapua-apex-cancelwatch")
    except lam.client.exceptions.ResourceNotFoundException:
        print("\n=== mapua-apex-cancelwatch: NOT FOUND ===")
        return {}
    vars_ = fn.get("Environment", {}).get("Variables", {})
    print(f"\n=== mapua-apex-cancelwatch (runtime={fn.get('Runtime')}, state={fn.get('State')}, timeout={fn.get('Timeout')}) ===")
    for key in sorted(vars_):
        print(f"  {key} = {mask(key, str(vars_[key]))}")
    # event source mapping health
    esms = lam.list_event_source_mappings(FunctionName="mapua-apex-cancelwatch")
    for m in esms.get("EventSourceMappings", []):
        print(f"  [ESM] {m.get('EventSourceArn')} state={m.get('State')} uuid={m.get('UUID')}")
    return {k: str(v) for k, v in vars_.items()}


def audit_amplify(region: str) -> dict[str, str]:
    amp = boto3.client("amplify", region_name=region)
    apps = amp.list_apps().get("apps", [])
    app = next((a for a in apps if a["name"] == "mapua-apex-frontend"), None)
    if app is None:
        print("\n=== Amplify app mapua-apex-frontend: NOT FOUND ===")
        return {}
    app_id = app["appId"]
    full = amp.get_app(appId=app_id)["app"]
    print(f"\n=== Amplify app {app['name']} (appId={app_id}, repo={full.get('repository')}) ===")
    print(f"  customDomain = {full.get('customDomain')}")
    app_vars = full.get("environmentVariables", {}) or {}
    print(f"  -- app-level environment variables ({len(app_vars)}) --")
    for name in sorted(app_vars):
        print(f"     {name} = {mask(name, str(app_vars[name]))}")
    for env in amp.list_branches(appId=app_id).get("branches", []):
        custom = env.get("environmentVariables", {}) or {}
        print(f"\n  -- branch {env['branchName']} (stage={env.get('stage')}, autoBuild={env.get('enableAutoBuild')}, framework={env.get('framework')})")
        print(f"     destination = {env.get('destinationBranch')}")
        print(f"     buildImage = {env.get('buildImage')}")
        if custom:
            for name in sorted(custom):
                print(f"     {name} = {mask(name, str(custom[name]))}")
        else:
            print("     (no branch-level env vars; inherits app-level)")
    return {str(k): str(v) for k, v in app_vars.items()}


def diff_against_local(local: dict[str, str], web: dict[str, str], cancel: dict[str, str], amplify: dict[str, str]) -> None:
    print("\n================ DIFF: root .env vs deployed ================")
    print("\n-- Backend keys present in .env but MISSING on the Web Function revision --")
    missing = [k for k in BACKEND_KEYS if local.get(k) and k not in web]
    print("  " + (", ".join(missing) if missing else "(none)"))
    print("\n-- Keys on BOTH (.env vs Web Function) with different values (secrets by presence only) --")
    for k in sorted(set(web) & set(local)):
        if any(h in k.upper() for h in SECRET_HINTS):
            if web.get(k) and not local.get(k):
                print(f"  {k}: deployed but empty locally")
            continue
        if local.get(k) != web.get(k):
            print(f"  {k}: .env={local.get(k)!r}  deployed={web.get(k)!r}")
    print("\n-- Extra keys on the Web Function not in .env --")
    extra = [k for k in sorted(web) if k not in local]
    print("  " + (", ".join(extra) if extra else "(none)"))
    print("\n-- cancelwatch consumer variables (informational) --")
    print("  " + (", ".join(sorted(cancel)) if cancel else "(none / not found)"))
    print("\n================ FRONTEND: VITE_* in .env vs Amplify app env =================")
    local_vite = {k: v for k, v in local.items() if k.startswith("VITE_")}
    print("\n-- VITE_* set locally but MISSING in Amplify --")
    print("  " + (", ".join(sorted(k for k in local_vite if k not in amplify and local_vite[k])) or "(none)"))
    print("-- VITE_* set in Amplify but MISSING/empty locally --")
    print("  " + (", ".join(sorted(k for k in amplify if k not in local_vite or not local_vite.get(k))) or "(none)"))
    print("-- VITE_* on BOTH but different values --")
    for k in sorted(set(local_vite) & set(amplify)):
        if local_vite[k].strip('"') != str(amplify[k]).strip('"'):
            print(f"  {k}: .env={local_vite[k]!r}  amplify={amplify[k]!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--region", default=None)
    args = parser.parse_args()
    local = load_root_env()
    region = args.region or local.get("AWS_DEFAULT_REGION") or "ap-southeast-1"
    web = audit_web_function(region)
    cancel = audit_cancelwatch(region)
    amplify = audit_amplify(region)
    diff_against_local(local, web, cancel, amplify)


if __name__ == "__main__":
    main()
