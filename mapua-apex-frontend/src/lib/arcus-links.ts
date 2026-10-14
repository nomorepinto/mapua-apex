/**
 * Deep links into the arcus companion apps, built from the public VITE_ARCUS_*
 * env vars. Each returns null when its base URL is unset, so callers hide the
 * button instead of rendering a dead link. Paths follow the agreed role targets:
 * attendance → /scanner (org_submitter), evaluation → /officer (both roles).
 */
function joinUrl(base: string | undefined, path: string): string | null {
  const trimmed = base?.trim().replace(/\/+$/, "")
  if (!trimmed) return null
  return `${trimmed}${path}`
}

export function arcusAttendanceUrl(): string | null {
  return joinUrl(import.meta.env.VITE_ARCUS_ATTENDANCE_URL, "/scanner")
}

export function arcusEvaluationUrl(): string | null {
  return joinUrl(import.meta.env.VITE_ARCUS_EVALUATION_URL, "/officer")
}