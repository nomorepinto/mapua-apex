import { memo, useCallback, useEffect, useState } from "react"
import { AlertCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"
import type { Activity } from "./activity.types"

export interface ReturnProposalModalProps {
  activity: Activity | null
  variant: "return" | "reject"
  open: boolean
  isSubmitting?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (comment: string) => void | Promise<void>
}

const COPY = {
  return: {
    title: "Return Proposal for Revision",
    description: "Specify the required revisions",
    reasonLabel: "Reason for return",
    placeholder: "Detail the specific corrections or documents required…",
    warningTitle: "This paper stays on your desk",
    warningBody:
      "The student can edit and resubmit. You will still see this submission with a Returned status.",
    warningClass: "bg-amber-50/80 border-amber-200/80 text-amber-900",
    iconClass: "text-amber-600",
    submit: "Return Proposal",
  },
  reject: {
    title: "Reject Proposal",
    description: "Explain why this submission is denied",
    reasonLabel: "Reason for rejection",
    placeholder: "Explain why this activity cannot be approved…",
    warningTitle: "This decision is final",
    warningBody:
      "The submission will be marked Denied. The student cannot edit it, and it will leave your queue.",
    warningClass: "bg-red-50/80 border-red-200/80 text-red-900",
    iconClass: "text-red-600",
    submit: "Reject Proposal",
  },
} as const

const ReturnProposalModal = memo(function ReturnProposalModal({
  activity,
  variant,
  open,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: ReturnProposalModalProps) {
  const [reason, setReason] = useState("")
  const copy = COPY[variant]
  const canSubmit = reason.trim().length > 0 && !isSubmitting

  useEffect(() => {
    if (!open) setReason("")
  }, [open, variant])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && !isSubmitting) onClose()
    },
    [isSubmitting, onClose],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const comment = reason.trim()
      if (!comment || isSubmitting) return
      await onSubmit(comment)
    },
    [isSubmitting, onSubmit, reason],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className={modal.dialogMd} nested>
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-bold text-neutral-900">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-500">
            {copy.description} for{" "}
            <span className="font-semibold text-neutral-800">{activity?.title}</span>.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "mx-6 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm",
            copy.warningClass,
          )}
        >
          <AlertCircleIcon className={cn("mt-0.5 h-4 w-4 shrink-0", copy.iconClass)} />
          <div>
            <p className="font-semibold">{copy.warningTitle}</p>
            <p className="mt-0.5 text-sm opacity-90">{copy.warningBody}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <DialogPanel className="space-y-4 p-6 pt-4">
            <div className="space-y-1.5">
              <label htmlFor="review-reason" className="text-sm font-semibold text-neutral-700">
                {copy.reasonLabel} <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="review-reason"
                placeholder={copy.placeholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={5000}
                rows={5}
                disabled={isSubmitting}
                className="w-full resize-none text-sm"
              />
            </div>
            {error ? (
              <p className="text-sm font-semibold text-rose-600">{error}</p>
            ) : null}
          </DialogPanel>

          <DialogFooter className={cn(layout.actions, "border-t border-neutral-100 p-4 pt-3 sm:p-6")}>
            <DialogClose
              disabled={isSubmitting}
              render={<Button variant="outline" type="button" disabled={isSubmitting} />}
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={!canSubmit}
              variant={variant === "reject" ? "destructive" : "default"}
              className={cn(
                "min-h-11 rounded-xl px-5 py-2 text-sm font-semibold",
                variant !== "reject" && "bg-neutral-900 text-white hover:bg-black",
              )}
            >
              {isSubmitting ? "Saving…" : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
})

export { ReturnProposalModal }
