"""Shared state handed from one phase to the next."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from apex_client import ApexClient
from config import Settings
from manifest import Manifest
from report import Report


@dataclass
class Paper:
    key: str
    event_id: str
    submission_id: str
    org: str
    lineup: list[str]
    payload: dict
    title: str


@dataclass
class RunContext:
    settings: Settings
    report: Report
    manifest: Manifest
    tag: str
    event_date: date
    skip_day_of: bool
    admin: ApexClient
    accounts: dict
    clients: dict[str, ApexClient] = field(default_factory=dict)
    ids: dict[str, str] = field(default_factory=dict)
    papers: dict[str, Paper] = field(default_factory=dict)
    keep_going: bool = False

    @property
    def date_key(self) -> str:
        return self.event_date.isoformat()

    @property
    def day_name(self) -> str:
        return self.event_date.strftime("%A")

    def client(self, key: str) -> ApexClient:
        if key not in self.clients:
            account = self.accounts[key]
            client = ApexClient(self.settings, self.manifest)
            client.login(account["email"], account["password"])
            self.clients[key] = client
        return self.clients[key]

    def refresh(self, key: str) -> ApexClient:
        self.clients.pop(key, None)
        return self.client(key)
