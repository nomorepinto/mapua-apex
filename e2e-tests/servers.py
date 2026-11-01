"""Start the four local apps for a run, and stop only the ones this process started."""

from __future__ import annotations

import os
import socket
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import requests

from config import ROOT, STATE_DIR, WORKSPACE


@dataclass(frozen=True)
class AppServer:
    name: str
    directory: Path
    script: str
    port: int
    ready_url: str


SERVERS = (
    AppServer("Nest", ROOT / "mapua-apex-backend-nest", "start", 3000, "http://127.0.0.1:3000/api/v2/ping"),
    AppServer("Vite", ROOT / "mapua-apex-frontend", "dev", 5176, "http://127.0.0.1:5176"),
    AppServer("Arcus Attendance", WORKSPACE / "arcus-attendance-system", "dev", 3001, "http://127.0.0.1:3001"),
    AppServer("Arcus Evaluation", WORKSPACE / "arcus-evaluation-system", "dev", 3002, "http://127.0.0.1:3002"),
)


def _accepting(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def _responding(url: str) -> bool:
    try:
        response = requests.get(url, timeout=3)
    except requests.RequestException:
        return False
    return response.status_code < 500


class StartedServers:
    def __init__(self) -> None:
        self._processes: list[tuple[AppServer, subprocess.Popen, object]] = []

    def start(self, timeout: int = 180) -> None:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        log_dir = STATE_DIR / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        pending: list[tuple[AppServer, subprocess.Popen]] = []
        for spec in SERVERS:
            if _responding(spec.ready_url):
                print(f"{spec.name} is already running on port {spec.port}")
                continue
            if _accepting(spec.port):
                raise RuntimeError(f"Port {spec.port} is in use, but {spec.name} is not answering {spec.ready_url}.")
            log_path = log_dir / f"{spec.port}.log"
            log_file = log_path.open("w", encoding="utf-8")
            command = f"npm run {spec.script}"
            print(f"Starting {spec.name}: {command} ({spec.directory.name})")
            flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
            process = subprocess.Popen(
                command,
                cwd=spec.directory,
                shell=True,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                creationflags=flags,
            )
            self._processes.append((spec, process, log_file))
            pending.append((spec, process))

        deadline = time.time() + timeout
        while pending:
            if time.time() > deadline:
                names = ", ".join(spec.name for spec, _ in pending)
                details = "\n".join(self._tail(spec) for spec, _ in pending)
                raise RuntimeError(f"Timed out waiting for {names}.\n{details}")
            still: list[tuple[AppServer, subprocess.Popen]] = []
            for spec, process in pending:
                if process.poll() is not None:
                    raise RuntimeError(f"{spec.name} exited with code {process.returncode}.\n{self._tail(spec)}")
                if _responding(spec.ready_url):
                    print(f"{spec.name} is ready on port {spec.port}")
                else:
                    still.append((spec, process))
            pending = still
            if pending:
                time.sleep(1)

    def stop(self) -> None:
        for spec, process, log_file in self._processes:
            if process.poll() is None:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                        capture_output=True,
                        check=False,
                    )
                else:
                    process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
            log_file.close()
            print(f"Stopped {spec.name}")
        self._processes.clear()

    def _tail(self, spec: AppServer) -> str:
        path = STATE_DIR / "logs" / f"{spec.port}.log"
        if not path.is_file():
            return f"{spec.name}: no log"
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        body = "\n".join(lines[-20:])
        return f"{spec.name} log:\n{body}"
