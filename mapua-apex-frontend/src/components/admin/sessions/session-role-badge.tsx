interface SessionRoleBadgeProps {
  role?: string
  email?: string
  userName?: string
}

export function SessionRoleBadge({ role = "unknown" }: SessionRoleBadgeProps) {
  const r = role.toLowerCase()

  if (r === "org_adviser" || r === "adviser" || r.includes("adviser")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        Adviser
      </span>
    )
  }
  if (r === "dean" || r.includes("dean")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
        Dean
      </span>
    )
  }
  if (r === "osaar" || r.includes("osaar")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        OSAAR
      </span>
    )
  }
  if (r === "cdm" || r.includes("cdm")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
        CDM
      </span>
    )
  }
  if (r === "admin" || r === "super_admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
        Admin
      </span>
    )
  }
  if (r === "signatory") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        Signatory
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
      {["student", "org_submitter"].includes(r) ? "Student" : role || "Unknown"}
    </span>
  )
}
