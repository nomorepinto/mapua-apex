import type { NotificationType } from "@/types/logs";

interface ActivityBadgeProps {
  type?: NotificationType | string;
}

export function ActivityBadge({ type = "" }: ActivityBadgeProps) {
  const norm = String(type || "").toLowerCase().replace(/_/g, " ");

  if (norm.includes("approve")) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
        approved
      </span>
    );
  }
  if (norm.includes("return") || norm.includes("revision")) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
        returned
      </span>
    );
  }
  if (norm.includes("deny") || norm.includes("denied")) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200 font-mono">
        denied
      </span>
    );
  }
  if (norm.includes("create") || norm.includes("submit") || norm.includes("submission")) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200">
        submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 border border-neutral-200">
      {type}
    </span>
  );
}
