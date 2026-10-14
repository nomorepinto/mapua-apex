# Local Event-Date Override (Testing Past the 10-Day Rule)

## What this is

A local-only escape hatch that lifts the **10-day minimum lead** on a proposal/event start date (and the room/equipment reservation date floor) so you can create proposals and reservations dated **today or any date — including the past**.

Use it to test time-sensitive features (approval -> published -> arcus attendance / evaluation, post-evaluation, "event happening today" flows) without waiting 10 days, changing any feature, or adding a UI setting.

It is driven by a **single shared `.env` flag** and changes **no production behavior**.

## The flag

`VITE_ALLOW_ANY_EVENT_DATE`, set in the repo-root `.env` (the one file both apps read):

| Value | Effect |
| :---- | :----- |
| `true` (and `APP_ENV=local` on the backend) | Override ON - any date accepted |
| unset / empty / anything else | OFF - normal 10-day rule (current behavior) |

## Prerequisites

- Node.js (frontend) and PHP + Composer (backend) installed.
- A repo-root `.env` (copy `.env.example` -> `.env` if you don't have one) with a valid `APP_KEY`, AWS/Cognito credentials, and `APP_ENV=local`.

## Enable it locally

> Note: your `vite.config.ts` does **not** configure a dev-server proxy, so where API calls go is decided by `VITE_API_BASE_URL`. You must run the backend locally for this feature to have any effect end-to-end.

1. **Set the flag.** In `<repo root>/.env` (FRONTEND / Vite block) add:
   ```bash
   VITE_ALLOW_ANY_EVENT_DATE=true
   ```

2. **Run the backend locally.**
   ```bash
   cd mapua-apex-backend
   php artisan config:clear   # only if you previously ran config:cache
   php artisan serve          # serves on http://127.0.0.1:8000
   ```

3. **Point the frontend at the local backend.** In `<repo root>/.env` change:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```

4. **Restart the dev server** (Vite bakes `VITE_*` at startup):
   ```bash
   cd mapua-apex-frontend
   npm run dev               # http://localhost:5176
   ```

You can now date the SAAF start/end date pickers and the reservation picker to today or a past date, and the local backend accepts the submission (HTTP 201).

## Disable / revert

- **Turn the override off:** set `VITE_ALLOW_ANY_EVENT_DATE=false` (or delete the line), then restart the backend and the Vite dev server. The 10-day rule returns.
- **Go back to the deployed backend:** restore `VITE_API_BASE_URL=https://mapua-apex.onrender.com/api/v1` and restart Vite; you can stop `php artisan serve`.

## Why production is safe

- The root `.env` is **gitignored**, so your local flag never ships in a commit.
- **Backend:** `config('app.allow_any_event_date')` requires `APP_ENV === 'local'`. Render runs `APP_ENV=production`, so the 10-day rule is always enforced there.
- **Frontend:** the override only turns on if `VITE_ALLOW_ANY_EVENT_DATE=true` is defined in the **Amplify** build environment. It is not, and you should **not** add it there.
- With the flag absent, every changed code path behaves exactly as it did before this feature.

## How it works (for maintainers)

### Frontend - single source of truth: `src/lib/date-key.ts`

```ts
export const ALLOW_ANY_EVENT_DATE =
  import.meta.env.VITE_ALLOW_ANY_EVENT_DATE === "true"
```

- `minEventDate()` uses a **0-day lead** when ON, so today is selectable and the reservation availability window still starts today.
- `eventDateFloor()` / `eventDateFloorKey()` return **`undefined`** when ON, which removes the `DatePicker` `minDate` and lets any date (incl. past) be selected.

Consumers:

- `src/components/submission/activity-details-section.tsx` - proposal start/end pickers; hides the "At least 10 days from today" hint.
- `src/components/submission/validate-saaf-step.ts` - skips the too-soon client check.
- `src/components/students/reservations/reservation-form.tsx` - relaxes the reservation picker floor.

### Backend

`config/app.php`:

```php
'allow_any_event_date' => env('APP_ENV') === 'local'
    && filter_var(env('VITE_ALLOW_ANY_EVENT_DATE', false), FILTER_VALIDATE_BOOLEAN),
```

`app/Http/Requests/Api/V1/SaafSubmissionRules.php` omits the `after_or_equal: now()->addDays(10)` rule on `activity_details.date_of_event` when the config is true. `end_date_of_event >= date_of_event` is still enforced, and the format is still `YYYY-MM-DD`.

## Gotchas

- **You must run the backend locally.** If the frontend still targets Render, the production backend rejects a too-soon date with **422** even though the UI lets you pick it.
- **Gated to `local`, not "non-production", on purpose.** The backend boots from the shared root `.env` even under `APP_ENV=testing`; a `!== 'production'` check would have leaked the flag into the test suite and broken the "too-soon -> 422" test. Keep future local-only flags gated to `=== 'local'`.
- **Reservation availability window is unchanged** (today..+180), so past reservation dates are selectable but won't show live slot availability.
- No new setting, no data-model change, nothing to migrate.

## Tests

- `SubmissionControllerTest::test_allows_same_day_event_date_when_override_is_enabled` proves the backend override path.
- To confirm the flag does **not** leak into the suite:
  ```bash
  VITE_ALLOW_ANY_EVENT_DATE=true php artisan test --filter=SubmissionControllerTest
  ```
  All tests (including the existing too-soon 422 case) must still pass.

## TL;DR

Set `VITE_ALLOW_ANY_EVENT_DATE=true` in the root `.env`, run the backend with `php artisan serve`, point `VITE_API_BASE_URL` at `http://localhost:8000/api/v1`, and restart the Vite dev server - proposals and reservations can then be dated today or any past date for local testing. Turn it off by removing the flag and restarting both servers. Production stays on the 10-day rule because the backend gate is `APP_ENV=local` and the frontend flag is never set in Amplify.
