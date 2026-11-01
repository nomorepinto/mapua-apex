"""Cognito password sign-in and the Nest /api/v2 client used by the phases."""

from __future__ import annotations

import base64
import json
from typing import Any

import requests

from config import Settings
from manifest import Manifest


class ApiError(Exception):
    def __init__(self, status: int, body: Any, method: str, path: str):
        self.status = status
        self.body = body
        self.method = method
        self.path = path
        message = body.get("message") if isinstance(body, dict) else body
        super().__init__(f"{method} {path} -> {status}: {message}")


def _jwt_payload(token: str) -> dict:
    part = token.split(".")[1]
    part += "=" * ((4 - len(part) % 4) % 4)
    return json.loads(base64.urlsafe_b64decode(part))


class Cognito:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _call(self, target: str, body: dict) -> dict:
        response = requests.post(
            self.settings.cognito_endpoint,
            headers={
                "Content-Type": "application/x-amz-json-1.1",
                "X-Amz-Target": f"AWSCognitoIdentityProviderService.{target}",
            },
            json=body,
            timeout=30,
        )
        data = response.json()
        if response.status_code >= 400:
            kind = str(data.get("__type", "Error")).split("#")[-1]
            raise ApiError(response.status_code, {"message": data.get("message", kind), "code": kind}, "POST", target)
        return data

    def sign_up(self, email: str, password: str, name: str) -> dict:
        return self._call(
            "SignUp",
            {
                "ClientId": self.settings.cognito_client_id,
                "Username": email,
                "Password": password,
                "UserAttributes": [
                    {"Name": "email", "Value": email},
                    {"Name": "name", "Value": name},
                ],
            },
        )

    def confirm(self, email: str, code: str) -> None:
        self._call(
            "ConfirmSignUp",
            {
                "ClientId": self.settings.cognito_client_id,
                "Username": email,
                "ConfirmationCode": code.strip(),
            },
        )

    def resend(self, email: str) -> None:
        self._call(
            "ResendConfirmationCode",
            {"ClientId": self.settings.cognito_client_id, "Username": email},
        )

    def sign_in(self, email: str, password: str) -> dict:
        data = self._call(
            "InitiateAuth",
            {
                "AuthFlow": "USER_PASSWORD_AUTH",
                "ClientId": self.settings.cognito_client_id,
                "AuthParameters": {"USERNAME": email, "PASSWORD": password},
            },
        )
        result = data.get("AuthenticationResult")
        if not result:
            raise ApiError(401, {"message": data.get("ChallengeName", "sign-in challenge")}, "POST", "InitiateAuth")
        token = result["IdToken"]
        payload = _jwt_payload(token)
        return {
            "id_token": token,
            "access_token": result.get("AccessToken", ""),
            "refresh_token": result.get("RefreshToken", ""),
            "expires_in": result.get("ExpiresIn", 3600),
            "sub": payload.get("sub"),
            "email": payload.get("email", email),
            "groups": payload.get("cognito:groups") or [],
        }


class ApexClient:
    def __init__(self, settings: Settings, manifest: Manifest | None = None):
        self.settings = settings
        self.manifest = manifest
        self.token: str | None = None
        self.session_id: str | None = None
        self.sub: str | None = None
        self.groups: list[str] = []

    def login(self, email: str, password: str, *, start_session: bool = True) -> dict:
        session = Cognito(self.settings).sign_in(email, password)
        self.token = session["id_token"]
        self.sub = session["sub"]
        groups = session["groups"]
        self.groups = list(groups) if isinstance(groups, list) else ([groups] if groups else [])
        self.session_id = None
        if not start_session:
            return session
        started = self.request("POST", "/sessions/start", {"deviceId": "e2e", "pagesVisited": []}, session=False)
        self.session_id = started.get("sessionId")
        if self.manifest:
            self.manifest.add_session(self.session_id)
        return session

    def call(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        params: dict | None = None,
        session: bool = True,
    ) -> tuple[int, Any]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if session and self.session_id:
            headers["X-Session-ID"] = self.session_id
        response = requests.request(
            method,
            f"{self.settings.api_base}{path}",
            headers=headers,
            json=body if body is not None else None,
            params=params,
            timeout=60,
        )
        try:
            payload = response.json() if response.content else {}
        except json.JSONDecodeError:
            payload = {"message": response.text[:300]}
        if isinstance(payload, dict) and "data" in payload and set(payload.keys()) <= {"data"}:
            payload = payload["data"]
        return response.status_code, payload

    def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        params: dict | None = None,
        session: bool = True,
    ) -> Any:
        status, payload = self.call(method, path, body, params=params, session=session)
        if status >= 400:
            raise ApiError(status, payload if isinstance(payload, dict) else {"message": payload}, method, path)
        return payload
