import { useCallback, useState } from "react"

import type { Activity } from "@/components/ui/activity.types"

export type ActivityCommentAction = "return" | "reject"

export function useActivityDetail({
  activity,
  onClose,
  onAction,
}: {
  activity: Activity | null
  onClose: () => void
  onAction?: (
    action: "approve" | "return" | "reject" | "defer",
    activityId: string,
    details?: { comment: string }
  ) => void | Promise<void>
}) {
  const [commentAction, setCommentAction] = useState<ActivityCommentAction | null>(null)
  const [confirmingApprove, setConfirmingApprove] = useState(false)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (confirmingApprove || commentAction) {
          setConfirmingApprove(false)
          setCommentAction(null)
          return
        }
        onClose()
      }
    },
    [commentAction, confirmingApprove, onClose]
  )

  const requestApprove = useCallback(() => {
    if (!activity) return
    setConfirmingApprove(true)
  }, [activity])

  const handleApprove = useCallback(async () => {
    if (!activity) return
    setConfirmingApprove(false)
    await onAction?.("approve", activity.id)
  }, [activity, onAction])

  const handleDefer = useCallback(async () => {
    setConfirmingApprove(false)
    setCommentAction(null)
    if (!activity) return
    await onAction?.("defer", activity.id)
  }, [activity, onAction])

  const handleCommentSubmit = useCallback(
    async (comment: string) => {
      if (!activity || !commentAction) return
      await onAction?.(commentAction, activity.id, { comment })
      setCommentAction(null)
    },
    [activity, commentAction, onAction]
  )

  return {
    commentAction,
    setCommentAction,
    confirmingApprove,
    setConfirmingApprove,
    handleOpenChange,
    requestApprove,
    handleApprove,
    handleDefer,
    handleCommentSubmit,
  }
}
