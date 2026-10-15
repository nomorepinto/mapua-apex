import { useState } from "react"

import { ConfirmSubmitModal } from "@/components/forms/confirm-submit-modal"
import { PostEvalDetailBody } from "@/components/posteval/posteval-detail-body"
import { usePostEvalsReview } from "@/components/osaar/postevals/postevals-review-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { useOsaarPostEvalDetailQuery } from "@/hooks/use-postevals"
import { modal } from "@/config"
import { LoadingBlock } from "@/components/ui/loading-block"
import { cn } from "@/lib/utils"

/**
 * OSAAR review modal for a single post-evaluation. Renders the same read-only
 * document the submitter sees (`PostEvalDetailBody`), then offers Approve/Deny
 * while the post-eval is still `submitted`. Both actions confirm first: approve
 * finishes the linked submission, deny leaves it approved.
 */
export function PostEvalReviewDialog() {
  const { selected, selectPostEval, approve, deny, isActing, actionError } =
    usePostEvalsReview()
  const { data, isPending, isError } = useOsaarPostEvalDetailQuery(
    selected?.eventId,
    selected?.postevalId
  )
  const [pending, setPending] = useState<"approve" | "deny" | null>(null)

  const isOpen = Boolean(selected)
  const isActionable = data?.status === "submitted"

  const close = () => {
    if (isActing) return
    setPending(null)
    selectPostEval(null)
  }

  const confirmAction = async () => {
    if (!selected || !pending) return
    const action = pending
    setPending(null)
    if (action === "approve") {
      await approve(selected)
    } else {
      await deny(selected)
    }
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogPopup
          className={cn(modal.dialogXl, "flex-col")}
          closeProps={{
            className:
              "text-white/80 hover:text-white hover:bg-white/10 top-5 end-5 cursor-pointer size-9",
          }}
        >
          <DialogHeader className="shrink-0 rounded-t-2xl bg-[#8B0000] px-4 py-6 text-white sm:px-8">
            <div className="w-full pr-10">
              <DialogTitle className="text-2xl font-extrabold tracking-tight leading-tight text-white sm:text-3xl">
                {data?.event_title || "Post-Evaluation"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-xs font-medium text-[#FBC02D] sm:text-sm">
                {data?.organization_name
                  ? `Filed by ${data.organization_name}`
                  : "Organization post-evaluation review"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogPanel className="flex-1 overflow-y-auto bg-white px-4 py-6 text-neutral-800 sm:px-8">
            {data ? (
              <PostEvalDetailBody postEval={data} />
            ) : isPending ? (
              <LoadingBlock
                className="py-6"
                label="Loading post-evaluation"
                rowClassName="h-24 w-full"
              />
            ) : isError ? (
              <p className="py-12 text-center text-sm font-semibold text-rose-600">
                Could not load this post-evaluation.
              </p>
            ) : null}
          </DialogPanel>

          <DialogFooter className="shrink-0 rounded-b-2xl border-t border-neutral-200 bg-white px-4 py-4 sm:px-8">
            <div className="flex w-full flex-col items-stretch justify-end gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {actionError ? (
                <p className="mr-auto text-xs font-semibold text-rose-600">{actionError}</p>
              ) : null}
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isActing}
                    className="min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold cursor-pointer"
                  />
                }
              >
                Close
              </DialogClose>
              {isActionable ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isActing}
                    onClick={() => setPending("deny")}
                    className="min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold cursor-pointer"
                  >
                    Deny
                  </Button>
                  <Button
                    type="button"
                    disabled={isActing}
                    onClick={() => setPending("approve")}
                    className={cn(
                      "min-h-11 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all",
                      isActing
                        ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                        : "bg-[#8B0000] hover:bg-[#6B0000] cursor-pointer"
                    )}
                  >
                    {isActing ? "Working…" : "Approve"}
                  </Button>
                </>
              ) : null}
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <ConfirmSubmitModal
        open={pending !== null}
        title={
          pending === "deny"
            ? "Deny this post-evaluation?"
            : "Approve this post-evaluation?"
        }
        description={
          pending === "deny"
            ? "The post-evaluation will be marked denied. The linked submission stays approved."
            : "The post-evaluation will be marked approved and the linked submission will be finished."
        }
        isSubmitting={isActing}
        onClose={() => setPending(null)}
        onConfirm={confirmAction}
      />
    </>
  )
}
