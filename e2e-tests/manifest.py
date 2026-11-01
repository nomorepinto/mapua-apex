"""Append-only record of ids a run created, plus the rows it must restore."""

from __future__ import annotations

import json
from pathlib import Path


class Manifest:
    def __init__(self, path: Path):
        self.path = path
        self.data = {
            "ids": [],
            "session_ids": [],
            "student_numbers": [],
            "subs": [],
            "usernames": [],
            "created_signatory_ids": [],
            "created_org_ids": [],
            "preexisting_cdm_id": None,
            "preexisting_cdm_holder": None,
            "settings_snapshotted": False,
            "settings_existed": False,
            "settings_item": None,
            "protected_pks": ["SETTINGS#APPROVAL"],
        }
        if path.is_file():
            self.data.update(json.loads(path.read_text(encoding="utf-8")))

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def add_id(self, value: str | None) -> None:
        if value and value not in self.data["ids"]:
            self.data["ids"].append(value)
            self.save()

    def add_session(self, value: str | None) -> None:
        if value and value not in self.data["session_ids"]:
            self.data["session_ids"].append(value)
            self.add_id(value)

    def add_student_number(self, value: str) -> None:
        if value not in self.data["student_numbers"]:
            self.data["student_numbers"].append(value)
            self.save()

    def add_account(self, sub: str | None, username: str | None) -> None:
        if sub and sub not in self.data["subs"]:
            self.data["subs"].append(sub)
        if username and username not in self.data["usernames"]:
            self.data["usernames"].append(username)
        self.save()

    @property
    def match_tokens(self) -> list[str]:
        tokens = [token for token in self.data["ids"] if len(token) >= 8]
        tokens += [f"STUDENT#{number}" for number in self.data["student_numbers"]]
        tokens += [f"USER#{sub}" for sub in self.data["subs"] if sub]
        return tokens


def load_manifests(state_dir: Path) -> list[Manifest]:
    if not state_dir.is_dir():
        return []
    return [Manifest(path) for path in sorted(state_dir.glob("manifest-*.json"))]
