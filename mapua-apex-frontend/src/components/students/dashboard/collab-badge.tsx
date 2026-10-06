import { Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"

/**
 * Compact badge flagging a submission as a collaboration and identifying the
 * caller's organization role in it. `proponent` owns and edits the application;
 * `dependent` is a read-only collaborating organization. Rendered only for
 * submissions that actually involve collaborating organizations.
 */
export function CollabBadge({
  role,
}: {
  role: "proponent" | "dependent"
}) {
  const isProponent = role !== "dependent"

  return (
    <Badge
      size="sm"
      variant={isProponent ? "info" : "outline"}
      className="ml-2 align-middle"
      title={
        isProponent
          ? "Collaboration — your organization is the proponent"
          : "Collaboration — your organization is a collaborating (dependent) organization"
      }
    >
      <Users />
      Collab · {isProponent ? "Proponent" : "Dependent"}
    </Badge>
  )
}
