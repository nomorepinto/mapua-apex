import { PostEvalDetailBody } from "@/components/posteval/posteval-detail-body"
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
import { usePostEvalDetailQuery } from "@/hooks/use-postevals"
import { modal } from "@/config"
import { LoadingBlock } from "@/components/ui/loading-block"
import { cn } from "@/lib/utils"

/**
 * Student-facing read-only view of a filed post-evaluation. Fetches the detail
 * (with a live participation re-aggregation) only while open.
 */
export function PostEvalDetailDialog({
  open,
  eventId,
  postevalId,
  onClose,
}: {
  open: boolean
  eventId?: string
  postevalId?: string
  onClose: () => void
}) {
  const { data, isPending, isError } = usePostEvalDetailQuery(
    open ? eventId : undefined,
    open ? postevalId : undefined
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPopup
        className={cn(
          modal.dialogLg,
          "overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-2xl"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200/80 bg-white px-4 py-5 sm:px-6">
          <div className="pr-8">
            <DialogTitle className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
              {data?.event_title || "Post-Evaluation"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-neutral-500 sm:text-sm">
              The post-evaluation your organization filed for this event.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 overflow-y-auto bg-neutral-50/50 px-4 py-6 sm:px-8">
          {isPending ? (
            <LoadingBlock
              className="py-6"
              label="Loading post-evaluation"
              rowClassName="h-24 w-full"
            />
          ) : isError || !data ? (
            <p className="py-12 text-center text-sm font-semibold text-rose-600">
              Could not load this post-evaluation.
            </p>
          ) : (
            <PostEvalDetailBody postEval={data} />
          )}
        </DialogPanel>

        <DialogFooter className="shrink-0 flex-row items-center justify-end border-t border-neutral-200/80 bg-white px-4 py-3.5 sm:px-6">
          <DialogClose render={<Button variant="outline" type="button" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
