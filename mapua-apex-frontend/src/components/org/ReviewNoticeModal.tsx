import { memo } from "react"

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
import { layout, modal } from "@/config"
import type { ReviewNotice } from "@/lib/dynamodb-adapters"
import { cn } from "@/lib/utils"

export interface ReviewNoticeModalProps {
  notice: ReviewNotice | null
  onClose: () => void
}

const ReviewNoticeModal = memo(function ReviewNoticeModal({
  notice,
  onClose,
}: ReviewNoticeModalProps) {
  const isDenied = notice?.notifType === "denied"

  return (
    <Dialog
      open={notice !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup className={modal.dialogMd}>
        <DialogHeader className="p-6 pb-3">
          <div className="mb-2">
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                isDenied ? "bg-red-50 text-[#D9291C]" : "bg-amber-50 text-amber-800",
              )}
            >
              {isDenied ? "Denied" : "Returned"}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold text-neutral-900">
            {notice?.title || "Review notice"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-500">
            {notice?.signatoryLabel || "Signatory"} · {notice?.dateStr}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-3 p-6 pt-2">
          <p className="text-sm font-semibold text-neutral-700">
            {isDenied ? "Reason for rejection" : "Reason for return"}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {notice?.comment}
          </p>
        </DialogPanel>

        <DialogFooter className={cn(layout.actions, "border-t border-neutral-100 p-4 sm:p-6")}>
          <DialogClose render={<Button variant="outline" type="button" />}>Close</DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
})

export { ReviewNoticeModal }
