import { Badge } from "@/components/ui/badge"
import type { Session } from "@/types/logs"

export function SessionStatusBadge({ session }: { session: Session }) {
  const variant =
    session.status === "active"
      ? "success"
      : session.status === "revoked"
        ? "destructive"
        : "secondary"
  return (
    <Badge variant={variant}>
      {session.status.replaceAll("_", " ")}
      {session.endReason ? ` (${session.endReason.replaceAll("_", " ")})` : ""}
    </Badge>
  )
}
