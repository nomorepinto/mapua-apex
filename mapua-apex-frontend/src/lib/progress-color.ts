export function getProgressColor(percent: number) {
  if (percent === 100) return "#10B981"
  if (percent >= 80) return "#EAB308"
  if (percent >= 60) return "#F59E0B"
  return "#D9291C"
}

export function getStatusTextColor(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return "text-[#10B981]"
    case "under review":
      return "text-[#3B82F6]"
    case "pending":
      return "text-[#F59E0B]"
    case "rejected":
      return "text-[#D9291C]"
    default:
      return "text-[#64748B]"
  }
}

export function formatRelativeTime(timestamp: Date | string) {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins <= 0) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  if (diffMins < 2880) return "Yesterday"

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
