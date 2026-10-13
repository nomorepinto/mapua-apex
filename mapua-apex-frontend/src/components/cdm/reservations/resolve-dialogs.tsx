import { useEffect, useState } from "react"
import { Ban, CalendarCheck, XCircle } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

interface ResolveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onConfirm: (comment: string) => void
}

/**
 * Shared comment-field dialog shell for the three CDM resolutions. Each variant
 * owns its own comment state (reset whenever the dialog reopens) so switching
 * between requests never leaks a stale note.
 */
function useComment(open: boolean) {
  const [comment, setComment] = useState("")
  useEffect(() => {
    if (!open) setComment("")
  }, [open])
  return { comment, setComment }
}

/** Confirm a full cancellation: lists every hold that will be released. */
export function CancelReservationDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
  holds,
}: ResolveDialogProps & { holds: string[] }) {
  const { comment, setComment } = useComment(open)

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
      open={open}
    >
      <DialogPopup className={modal.dialogLg} nested>
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-bold text-neutral-900">
            Cancel this event?
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-500">
            The paper is marked cancelled and every hold below is released. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4 p-6 pt-2">
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-neutral-700">
              Holds to release
            </span>
            {holds.length === 0 ? (
              <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                No holds are linked to this request.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {holds.map((line, index) => (
                  <li
                    className="flex items-start gap-2 rounded-lg border border-red-200/70 bg-red-50/60 p-2.5 text-sm text-red-900"
                    key={`${line}-${index}`}
                  >
                    <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-red-600" />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              className="text-sm font-semibold text-neutral-700"
              htmlFor="cancel-comment"
            >
              Comment{" "}
              <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <Textarea
              className="w-full resize-none text-sm"
              disabled={isPending}
              id="cancel-comment"
              maxLength={500}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Shown to the student in their timeline…"
              rows={3}
              value={comment}
            />
          </div>
        </DialogPanel>

        <DialogFooter
          className={cn(layout.actions, "border-t border-neutral-100 p-4 sm:p-6")}
        >
          <DialogClose
            disabled={isPending}
            render={<Button disabled={isPending} type="button" variant="outline" />}
          >
            Keep event
          </DialogClose>
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={() => onConfirm(comment)}
            type="button"
            variant="destructive"
          >
            Cancel event
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

/** Deny the request; a comment explaining why is required. */
export function DenyReservationDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: ResolveDialogProps) {
  const { comment, setComment } = useComment(open)
  const canConfirm = comment.trim().length > 0 && !isPending

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
      open={open}
    >
      <DialogPopup className={modal.dialogMd} nested>
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-bold text-neutral-900">
            Deny this request?
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-500">
            The paper and its holds stay exactly as they are. Tell the student
            why the change was denied.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-1.5 p-6 pt-2">
          <label
            className="text-sm font-semibold text-neutral-700"
            htmlFor="deny-comment"
          >
            Comment <span className="text-red-500">*</span>
          </label>
          <Textarea
            className="w-full resize-none text-sm"
            disabled={isPending}
            id="deny-comment"
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Reason for denying this request…"
            required
            rows={4}
            value={comment}
          />
          <p className="text-right text-[11px] text-neutral-400">
            {comment.length}/500
          </p>
        </DialogPanel>

        <DialogFooter
          className={cn(layout.actions, "border-t border-neutral-100 p-4 sm:p-6")}
        >
          <DialogClose
            disabled={isPending}
            render={<Button disabled={isPending} type="button" variant="outline" />}
          >
            Back
          </DialogClose>
          <Button
            disabled={!canConfirm}
            loading={isPending}
            onClick={() => onConfirm(comment)}
            type="button"
            variant="destructive"
          >
            <XCircle aria-hidden="true" />
            Deny request
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}

/** Confirm a reschedule: reviews the per-hold old → new summary. */
export function RescheduleReservationDialog({
  open,
  onOpenChange,
  isPending,
  onConfirm,
  lines,
}: ResolveDialogProps & { lines: string[] }) {
  const { comment, setComment } = useComment(open)

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
      open={open}
    >
      <DialogPopup className={modal.dialogLg} nested>
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-bold text-neutral-900">
            Apply reschedule?
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-500">
            The targeted holds and the paper's event date/time are rewritten to
            match. Review the changes below.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4 p-6 pt-2">
          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-neutral-700">
              Changes
            </span>
            <ul className="space-y-1.5">
              {lines.map((line, index) => (
                <li
                  className="flex items-start gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-2.5 text-sm text-emerald-900"
                  key={`${line}-${index}`}
                >
                  <CalendarCheck
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-emerald-600"
                  />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <label
              className="text-sm font-semibold text-neutral-700"
              htmlFor="reschedule-comment"
            >
              Comment{" "}
              <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <Textarea
              className="w-full resize-none text-sm"
              disabled={isPending}
              id="reschedule-comment"
              maxLength={500}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Shown to the student in their timeline…"
              rows={3}
              value={comment}
            />
          </div>
        </DialogPanel>

        <DialogFooter
          className={cn(layout.actions, "border-t border-neutral-100 p-4 sm:p-6")}
        >
          <DialogClose
            disabled={isPending}
            render={<Button disabled={isPending} type="button" variant="outline" />}
          >
            Back
          </DialogClose>
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={() => onConfirm(comment)}
            type="button"
          >
            <CalendarCheck aria-hidden="true" />
            Apply reschedule
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
