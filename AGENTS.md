# Project Agent Guidelines

These rules apply across the entire repository (both `mapua-apex-frontend` and `mapua-apex-backend`). Each sub-project also has its own `AGENTS.md` with system-specific rules — read and follow the relevant sub-project file in addition to this one.

## Cross-System Changes

- This repository spans two independent systems: a frontend and a backend. When a change you are making in one system requires a corresponding change in the other (for example, an API route/contract change driven by a UI need, or a UI change driven by a backend response change), **stop and consult the user before modifying the second system.**
- Do not assume it is okay to edit the other system just to make your current change work. Surface the required cross-system edit, describe its scope, and wait for approval before touching files outside the system you were asked to work in.

## Cloud Scripts (boto3)

- When asked to write a script that utilizes cloud resources through **boto3**, always place the script in the `mapua-apex-frontend/scripts/` folder.
- End the response with both: (1) the exact command line to execute the script (e.g. `python scripts/<name>.py --flags`), and (2) a short TL;DR of what the script does.
