import { expect, type Page } from "@playwright/test"

/**
 * The real auto-cancel trigger — a TTL expiry emitting a DynamoDB Streams
 * `REMOVE` handled by the consumer Lambda — cannot fire against the hosted
 * table inside a browser test. The local-only `POST /admins/cancel-watch/expire`
 * route runs the identical production `evaluateAndCancel` path on demand, so
 * this page object drives it directly over HTTP (there is no UI affordance).
 *
 * Requests are sent with the caller's own Cognito ID token and active session
 * id (read back from the browser the page was opened in), because every
 * business route is gated by the roles + active-session guards.
 */

/** Statuses returned by the expire route (mirrors `CancelWatchResult.status`). */
export type ExpireStatus = "cancelled" | "post-eval filed" | "not-approved" | "disabled"

/** The auto-cancel comment tail, asserted independent of the title/day count. */
export const AUTO_CANCEL_COPY = "closed with no post-evaluation filed"

type AdminSubmissionRow = {
  event_id: string
  submission_id: string
  activity_details?: { title_and_nature?: string } | null
}

function apiBase(): string {
  return (process.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v2").replace(/\/$/, "")
}

export class CancelWatchPage {
  constructor(private readonly page: Page) {}

  /**
   * Collect the auth headers from the browser the app already signed into. The
   * SPA starts an active session as soon as a guarded route mounts, so wait for
   * `apex_session_id` before issuing the request (a missing header is a 428).
   */
  private async headers(): Promise<Record<string, string>> {
    const creds = await this.page.evaluate(async () => {
      const read = () => {
        const key = Object.keys(sessionStorage).find((k) => k.startsWith("oidc.user:"));
        const raw = key ? sessionStorage.getItem(key) : null;
        const token = raw ? (JSON.parse(raw).id_token as string | undefined) : undefined;
        const sessionId = localStorage.getItem("apex_session_id");
        return { token: token ?? "", sessionId: sessionId ?? "" };
      };
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const current = read();
        if (current.token && current.sessionId) return current;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return read();
    });
    expect(creds.token, "No Cognito ID token in the opened session").not.toEqual("");
    const headers: Record<string, string> = { Authorization: `Bearer ${creds.token}` };
    if (creds.sessionId) headers["X-Session-ID"] = creds.sessionId;
    return headers;
  }

  /** Resolve a submission's event/submission ids from the admin list by title. */
  async findIds(title: string): Promise<{ eventId: string; submissionId: string }> {
    const response = await this.page.request.get(`${apiBase()}/admins/submissions`, {
      headers: await this.headers(),
    });
    expect(response.ok(), `admin submissions list failed: ${response.status()}`).toBeTruthy();
    // The global envelope interceptor wraps collections in `{ data }`.
    const body = (await response.json()) as
      | AdminSubmissionRow[]
      | { data: AdminSubmissionRow[] }
    const rows = Array.isArray(body) ? body : body.data;
    const row = rows.find((r) => (r.activity_details?.title_and_nature ?? "").includes(title));
    expect(row, `no admin submission found for "${title}"`).toBeTruthy();
    return { eventId: row!.event_id, submissionId: row!.submission_id };
  }

  /** Fire the production auto-cancel path for one event/submission. */
  async expire(eventId: string, submissionId: string): Promise<ExpireStatus> {
    const response = await this.page.request.post(`${apiBase()}/admins/cancel-watch/expire`, {
      headers: await this.headers(),
      data: { event_id: eventId, submission_id: submissionId },
    });
    expect(response.ok(), `cancel-watch expire failed: ${response.status()}`).toBeTruthy();
    const body = (await response.json()) as { status: ExpireStatus };
    return body.status;
  }

  /** Locate by title, then expire — the common two-step used by the specs. */
  async expireByTitle(title: string): Promise<ExpireStatus> {
    const { eventId, submissionId } = await this.findIds(title);
    return this.expire(eventId, submissionId);
  }

  /**
   * Assert the auto-cancel notice surfaced on the (already-open) student
   * dashboard's Timeline Reminders, which renders every review notice with its
   * comment and a Cancelled badge. The reminders list is expanded by default.
   */
  async expectAutoCancelNotice(title: string): Promise<void> {
    const item = this.page
      .getByRole("button")
      .filter({ hasText: title })
      .filter({ hasText: AUTO_CANCEL_COPY })
      .first();
    await expect(item).toBeVisible();
    await expect(item).toContainText("Cancelled");
  }
}
