"""Load the monorepo env files the suite is allowed to read, never write."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
E2E_DIR = Path(__file__).resolve().parent
ACCOUNTS_PATH = E2E_DIR / "accounts.local.json"
STATE_DIR = E2E_DIR / "state"
REPORTS_DIR = E2E_DIR / "reports"
AUTH_DIR = E2E_DIR / ".auth"
ADMIN_FILE = ROOT / ".grokadmin"

ENV_FILES = [
    ROOT / ".env",
    WORKSPACE / "arcus-attendance-system" / ".env",
    WORKSPACE / "arcus-evaluation-system" / ".env",
]


def _merged_env() -> dict[str, str]:
    merged: dict[str, str] = {}
    for path in ENV_FILES:
        if not path.is_file():
            continue
        for key, value in dotenv_values(path).items():
            if value is not None and key not in os.environ:
                merged[key] = value
    for key, value in os.environ.items():
        merged[key] = value
    return merged


def apply_env() -> dict[str, str]:
    env = _merged_env()
    for key, value in env.items():
        os.environ.setdefault(key, value)
    return env


@dataclass(frozen=True)
class Settings:
    api_base: str
    frontend_base: str
    attendance_base: str
    evaluation_base: str
    app_env: str
    allow_any_event_date: bool
    cognito_region: str
    cognito_client_id: str
    cognito_pool_id: str
    cognito_domain: str
    table_name: str
    aws_region: str
    deletion_cap: int = 5000

    @property
    def cognito_endpoint(self) -> str:
        return f"https://cognito-idp.{self.cognito_region}.amazonaws.com/"


def load_settings() -> Settings:
    env = apply_env()
    authority = env.get("VITE_COGNITO_AUTHORITY", "")
    region = env.get("AWS_DEFAULT_REGION") or env.get("AWS_REGION") or "ap-southeast-1"
    if "cognito-idp." in authority:
        region = authority.split("cognito-idp.")[1].split(".")[0]
    pool = env.get("AWS_COGNITO_USER_POOL_ID") or env.get("COGNITO_USER_POOL_ID", "")
    domain = env.get("VITE_COGNITO_DOMAIN") or env.get("COGNITO_DOMAIN", "")
    domain = domain.removeprefix("https://").strip("/")
    return Settings(
        api_base=env.get("VITE_API_BASE_URL", "").rstrip("/"),
        frontend_base=env.get("FRONTEND_URL", "http://localhost:5176").rstrip("/"),
        attendance_base=env.get("E2E_ATTENDANCE_BASE", "http://localhost:3001").rstrip("/"),
        evaluation_base=env.get("E2E_EVALUATION_BASE", "http://localhost:3002").rstrip("/"),
        app_env=env.get("APP_ENV", ""),
        allow_any_event_date=env.get("VITE_ALLOW_ANY_EVENT_DATE", "").lower() == "true",
        cognito_region=region,
        cognito_client_id=env.get("VITE_COGNITO_CLIENT_ID") or env.get("AWS_COGNITO_CLIENT_ID", ""),
        cognito_pool_id=pool.strip('"'),
        cognito_domain=domain.strip('"'),
        table_name=(env.get("AWS_DYNAMODB_TABLE") or env.get("DYNAMODB_TABLE_NAME", "")).strip('"'),
        aws_region=env.get("AWS_DEFAULT_REGION") or region,
    )
