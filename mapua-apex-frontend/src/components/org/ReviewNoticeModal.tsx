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

interface NoticeVariant {
  badge: string
  badgeClass: string
  heading: string
  /** Shown when an approval was recorded without a comment. */
  fallback: string
}

const VARIANTS: Record<ReviewNotice["notifType"], NoticeVariant> = {
  denied: {
    badge: "Denied",
    badgeClass: "bg-red-50 text-[#D9291C]",
    heading: "Reason for rejection",
    fallback: "",
  },
  returned: {
    badge: "Returned",
    badgeClass: "bg-amber-50 text-amber-800",
    heading: "Reason for return",
    fallback: "",
  },
  approved: {
    badge: "Approved",
    badgeClass: "bg-emerald-50 text-emerald-700",
    heading: "Approval note",
    fallback: "Approved and forwarded to the next signatory.",
  },
  "fully approved": {
    badge: "Fully Approved",
    badgeClass: "bg-emerald-50 text-emerald-700",
    heading: "Approval note",
    fallback: "All signatories have approved this submission.",
  },
}

const ReviewNoticeModal = memo(function ReviewNoticeModal({
  notice,
  onClose,
}: ReviewNoticeModalProps) {
  const variant = notice ? VARIANTS[notice.notifType] : VARIANTS.returned
  const body = notice?.comment?.trim()
    ? notice.comment
    : variant.fallback || notice?.comment

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
                variant.badgeClass,
              )}
            >
              {variant.badge}
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
            {variant.heading}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {body}
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
