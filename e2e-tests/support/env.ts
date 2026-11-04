import fs from "node:fs"
import path from "node:path"

export const root = process.cwd()

export const frontendBase = (process.env.E2E_FRONTEND_BASE ?? "http://127.0.0.1:5176").replace(/\/$/, "")
// The Arcus apps set host-only session cookies for APP_BASE_URL's host, so the
// page must use that same host. localhost and 127.0.0.1 are different cookie jars.
const arcusBase = (value: string | undefined, port: number) =>
  (value ?? `http://localhost:${port}`).replace("127.0.0.1", "localhost").replace(/\/$/, "")

export const attendanceBase = arcusBase(process.env.E2E_ATTENDANCE_BASE, 3001)
export const evaluationBase = arcusBase(process.env.E2E_EVALUATION_BASE, 3002)

export const tag = process.env.E2E_TAG ?? "local"
export const eventDate = process.env.E2E_EVENT_DATE ?? new Date().toISOString().slice(0, 10)
export const skipDayOf = process.env.E2E_SKIP_DAY_OF === "1"

export const manifestPath = process.env.MANIFEST_PATH
  ? path.resolve(process.env.MANIFEST_PATH)
  : path.join(root, "state", `manifest-${tag}.json`)

export const runStatePath = path.join(root, "state", "run.json")
export const authDir = path.join(root, ".auth")

export type Account = { email: string; password: string }

export function accounts(): Record<string, Account> {
  const file = path.join(root, "accounts.local.json")
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { accounts: Record<string, Account> }
  return parsed.accounts
}

export function account(key: string): Account {
  const found = accounts()[key]
  if (!found) throw new Error(`Missing e2e account ${key}. Run: python run_e2e.py bootstrap`)
  return found
}
