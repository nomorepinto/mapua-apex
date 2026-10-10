interface SessionRoleBadgeProps {
  role?: string;
  email?: string;
  userName?: string;
}

export function SessionRoleBadge({ role = "", email = "", userName = "" }: SessionRoleBadgeProps) {
  const r = role.toLowerCase();
  const lowerEmail = email.toLowerCase();
  const lowerName = userName.toLowerCase();

  if (
    r === "org_adviser" ||
    r === "adviser" ||
    r.includes("adviser") ||
    lowerEmail.includes("adviser") ||
    lowerName.includes("adviser")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
        Adviser
      </span>
    );
  }
  if (
    r === "dean" ||
    r.includes("dean") ||
    lowerEmail.includes("dean") ||
    lowerName.includes("dean")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
        Dean
      </span>
    );
  }
  if (
    r === "osaar" ||
    r.includes("osaar") ||
    lowerEmail.includes("osaar") ||
    lowerName.includes("osaar")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
        OSAAR
      </span>
    );
  }
  if (
    r === "cdm" ||
    r.includes("cdm") ||
    lowerEmail.includes("cdm") ||
    lowerName.includes("cdm") ||
    lowerName.includes("director")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
        CDM
      </span>
    );
  }
  if (r === "admin" || lowerEmail.includes("admin") || lowerName.includes("admin")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
        Admin
      </span>
    );
  }
  if (r === "signatory") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
        Adviser
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 border border-neutral-200">
      Student
    </span>
  );
}
