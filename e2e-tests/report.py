"""Step log and the markdown / JSON report for one run."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass
class Step:
    name: str
    status: str
    detail: str = ""
    http: int | None = None
    gap: bool = False

    def line(self) -> str:
        http = f" HTTP {self.http}" if self.http is not None else ""
        detail = f" — {self.detail}" if self.detail else ""
        return f"[{self.status.upper()}] {self.name}{http}{detail}"


@dataclass
class Report:
    tag: str
    steps: list[Step] = field(default_factory=list)
    cleanup_before: int = 0
    cleanup_after: int = 0
    leftovers: int = -1

    def add(self, step: Step) -> Step:
        self.steps.append(step)
        print(step.line(), flush=True)
        return step

    def passed(self) -> bool:
        failed = [step for step in self.steps if step.status == "fail" and not step.gap]
        return not failed and self.leftovers == 0

    def write(self, directory: Path) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        payload = {
            "tag": self.tag,
            "passed": self.passed(),
            "cleanup_before": self.cleanup_before,
            "cleanup_after": self.cleanup_after,
            "leftovers": self.leftovers,
            "steps": [asdict(step) for step in self.steps],
        }
        (directory / "report.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
        lines = [
            f"# E2E report {self.tag}",
            "",
            f"Cleanup deleted {self.cleanup_before} items before the run and {self.cleanup_after} after.",
            f"Leftover matches: {self.leftovers}.",
            "",
        ]
        for step in self.steps:
            lines.append(f"- {step.line()}")
        path = directory / "report.md"
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path
