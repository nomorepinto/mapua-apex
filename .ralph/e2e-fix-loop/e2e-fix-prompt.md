# One product bug from the APEX end-to-end suite

You are one pass of a fix loop. The shell already ran `python run_e2e.py` and will run it again after you finish. You handle the single failure named in the task file, then stop.

## What counts as a product bug

A product bug is the application doing the wrong thing while the test is checking the behavior the app is supposed to have.

These are not product bugs. Do not edit code for them:

- A server, login, AWS, DynamoDB, Cognito, or cleanup failure
- A step the suite marked as a gap
- A test that expects the wrong behavior, calls the wrong route, or built the wrong fixture
- A failure you cannot explain from the application source

## Rules

- Fix one bug: the step named in the task file. Leave every other failure for the next pass.
- Change application code in `mapua-apex-backend-nest`, `mapua-apex-frontend`, `arcus-attendance-system`, or `arcus-evaluation-system`.
- You may edit `e2e-tests/support/**` and `e2e-tests/pages/**` (harness helpers and page objects) to fix locator drift or auth flow changes. Do not edit `e2e-tests/tests/**` (specs) or flip a failure into a gap, skip an assertion, or loosen a test to make the run pass.
- Do not edit this prompt or the loop script.
- Do not open `.env`, `.env.*`, `.grokadmin`, or `accounts.local.json`.
- Do not run `git commit`, `git add`, `git push`, or `git reset`. The loop commits after you exit.
- Do not start a new test run. The loop does that.

## Verdict

Write the verdict file to the path given in the task file, under `.ralph/e2e-fix-loop`. When you are not fixing a product bug, that verdict file is the only file you write.

```json
{
  "kind": "product",
  "summary": "One sentence on the cause and the fix.",
  "commit_message": "fixed the specific behavior"
}
```

`kind` is `product`, `test`, or `environment`.

- `product`: you changed files (application code OR harness helpers under `e2e-tests/support/**` / `e2e-tests/pages/**`). `commit_message` is one lowercase line, under 72 characters, in the same style as `fixed routes`. No ticket id, no period, no secret. The loop commits your changes only when kind is `product`.
- `test`: the spec or fixture is wrong and you changed NO files. Say why in `summary`.
- `environment`: AWS/Cognito/DynamoDB config issue and you changed NO files. Before giving up, check if a boto3 script in `mapua-apex-frontend/scripts/` could fix it (e.g., `add_cognito_arcus_callbacks.py` for redirect URLs, `add_cognito_client_scopes.py` for OAuth scopes). If a script exists or could be written, say so in `summary` and set `kind` to `product` instead. Only use `environment` if the fix requires manual AWS console work or credentials the loop doesn't have.

Diagnosing an empty Arcus event dropdown (a scanner/officer `getByRole("option", { name: /<event title>/ })` times out, or the events list is blank): the Arcus app's `/api/apex/events` proxy is failing, not the browser flow. Curl the local backend directly, e.g. `curl -H "X-Arcus-Service-Token: <token>" "http://127.0.0.1:3000/api/v2/arcus/events?window=attendance"`. The Nest backend's global prefix is `api/v2`. A 200 there but an empty dropdown means the Arcus app's `APEX_API_BASE_URL` (in its gitignored `.env`, which you cannot open or edit) points at the wrong host or version — for example the production `.../api/v1`, which 404s. That is an environment issue the operator must fix: set `kind` to `environment` and say in `summary` that `APEX_API_BASE_URL` in the Arcus app `.env` must point at the local backend `http://127.0.0.1:3000/api/v2`. Do not burn turns trying to fix it in code.

IMPORTANT: If you edited ANY file (including page objects or support helpers), you MUST use `kind: "product"` with a `commit_message`. Using `test` or `environment` after changing files causes the loop to stop WITHOUT committing your work.

After the verdict file is written, stop.
