"""Sign in through the Cognito hosted UI once, then call Arcus with the cookies."""

from __future__ import annotations

import json
from pathlib import Path

import requests

from config import AUTH_DIR, Settings


class ArcusSession:
    def __init__(self, settings: Settings, base: str, account_key: str, email: str, password: str):
        self.settings = settings
        self.base = base.rstrip("/")
        self.path = AUTH_DIR / f"{account_key}-{base.split(':')[-1]}.json"
        self.http = requests.Session()
        if not self.path.is_file():
            self._login(email, password)
        self._load()

    def _login(self, email: str, password: str) -> None:
        from playwright.sync_api import sync_playwright

        AUTH_DIR.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"{self.base}/api/auth/login", wait_until="domcontentloaded")
            page.locator("input[name='username'], input[name='email'], input[type='email']").first.fill(email)
            page.locator("input[name='password'], input[type='password']").first.fill(password)
            page.locator("button[type='submit'], input[type='submit']").first.click()
            page.wait_for_url(f"{self.base}/**", timeout=30000)
            page.context.storage_state(path=str(self.path))
            browser.close()

    def _load(self) -> None:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        for cookie in data.get("cookies", []):
            self.http.cookies.set(cookie["name"], cookie["value"], domain=cookie.get("domain"), path=cookie.get("path", "/"))

    def request(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
        response = self.http.request(method, f"{self.base}{path}", json=body, timeout=60)
        try:
            payload = response.json() if response.content else {}
        except json.JSONDecodeError:
            payload = {"message": response.text[:300]}
        return response.status_code, payload


def forget(path: Path) -> None:
    if path.is_file():
        path.unlink()
