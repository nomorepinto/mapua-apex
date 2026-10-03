import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react"

import type { AuditLogEntry } from "@/stores/admin-osa-store"

export function formatAuditTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export const AUDIT_ACTION_CONFIG: Record<
  AuditLogEntry["action"],
  { label: string; icon: typeof CheckCircleIcon; color: string }
> = {
  submission_created: {
    label: "Submission Created",
    icon: PlusIcon,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  submission_approved: {
    label: "Approved",
    icon: CheckCircleIcon,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  submission_denied: {
    label: "Denied / Returned",
    icon: AlertTriangleIcon,
    color: "text-red-600 bg-red-50 border-red-200",
  },
  account_updated: {
    label: "Account Updated",
    icon: PencilIcon,
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  announcement_created: {
    label: "Announcement",
    icon: FileTextIcon,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  status_changed: {
    label: "Status Changed",
    icon: ClockIcon,
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
}

export function exportAuditLogCsv(
  logs: AuditLogEntry[],
  orgNameMap: Map<string, string>
) {
  const header = "Timestamp,Action,Actor,Organization,Description"
  const escaped = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = logs.map((log) => {
    const orgName = log.orgId ? (orgNameMap.get(log.orgId) ?? log.orgId) : "System"
    return [
      escaped(formatAuditTimestamp(log.timestamp)),
      escaped(AUDIT_ACTION_CONFIG[log.action].label),
      escaped(log.actor),
      escaped(orgName),
      escaped(log.description),
    ].join(",")
  })

  const csv = [header, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `apex_system_audit_log_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
