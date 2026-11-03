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
- Do not create or edit anything under `mapua-apex/e2e-tests`. Do not edit this prompt or the loop script. Do not flip a failure into a gap, skip an assertion, or loosen a test to make the run pass.
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

- `product`: you changed application code. `commit_message` is one lowercase line, under 72 characters, in the same style as `fixed routes`. No ticket id, no period, no secret.
- `test` or `environment`: change no files. Say why in `summary`.

After the verdict file is written, stop.
