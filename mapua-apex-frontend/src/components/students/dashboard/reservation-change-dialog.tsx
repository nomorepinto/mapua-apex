import { useCallback, useEffect, useState } from "react"
import { AlertCircleIcon, CalendarClock, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
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
import { toastManager } from "@/components/ui/toast"
import { layout, modal } from "@/config"
import { mutationErrorMessage } from "@/hooks/use-admin"
import {
  useReservationChangesQuery,
  useStoreReservationChangeMutation,
} from "@/hooks/use-reservation-changes"
import { useSubmissionDetailQuery } from "@/hooks/use-submissions"
import { formatDisplayDate } from "@/lib/dynamodb-adapters"
import { getTodayManila } from "@/lib/monitor-formatters"
import { slotLabel } from "@/lib/schedule-slots"
import type { ReservationChangeRequestType } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface ReservationChangeDialogProps {
  eventId?: string
  submissionId?: string
  onClose: () => void
}

const REQUEST_OPTIONS: Array<{
  value: ReservationChangeRequestType
  label: string
}> = [
  { value: "reschedule", label: "Reschedule" },
  { value: "cancel", label: "Cancel event" },
]

/**
 * Student dialog opened from a Scheduled timeline notice. Requests a cancel or
 * reschedule of the paper's live holds: shows the frozen targets read-only, an
 * optional suggested date (reschedule), and a required reason. CDM decides the
 * outcome, so the suggested date is advisory only. The event-day window is a
 * client-side convenience — the backend enforces it authoritatively.
 */
export function ReservationChangeDialog({
  eventId,
  submissionId,
  onClose,
}: ReservationChangeDialogProps) {
  const open = Boolean(eventId && submissionId)
  const [requestType, setRequestType] =
    useState<ReservationChangeRequestType>("reschedule")
  const [reason, setReason] = useState("")
  const [suggestedDate, setSuggestedDate] = useState("")

  const detailQuery = useSubmissionDetailQuery(eventId, submissionId)
  const changesQuery = useReservationChangesQuery(eventId, submissionId)
  const storeMutation = useStoreReservationChangeMutation()

  const submission = detailQuery.data
  const holds = submission?.venue_reservation?.reservations ?? []
  const dateOfEvent = submission?.activity_details?.date_of_event ?? ""
  const title = submission?.activity_details?.title_and_nature || "this event"

  const pendingChange = (changesQuery.data ?? []).find(
    (change) => change.status === "pending"
  )
  const todayManila = getTodayManila()
  const windowClosed = Boolean(dateOfEvent) && todayManila > dateOfEvent

  useEffect(() => {
    if (!open) {
      setRequestType("reschedule")
      setReason("")
      setSuggestedDate("")
    }
  }, [open])

  const canSubmit =
    reason.trim().length > 0 &&
    !windowClosed &&
    !pendingChange &&
    !storeMutation.isPending

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && !storeMutation.isPending) onClose()
    },
    [onClose, storeMutation.isPending]
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      if (!eventId || !submissionId || !canSubmit) return
      try {
        await storeMutation.mutateAsync({
          eventId,
          submissionId,
          request_type: requestType,
          reason: reason.trim(),
          suggested_date:
            requestType === "reschedule" && suggestedDate
              ? suggestedDate
              : undefined,
        })
        toastManager.add({
          title: "Request sent",
          description: "CDM will review your reservation change request.",
          type: "success",
        })
        onClose()
      } catch (error) {
        toastManager.add({
          title: "Could not send request",
          description: mutationErrorMessage(error, "Please try again."),
          type: "error",
        })
      }
    },
    [
      canSubmit,
      eventId,
      onClose,
      reason,
      requestType,
      storeMutation,
      submissionId,
      suggestedDate,
    ]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className={modal.dialogLg} nested>
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-bold text-neutral-900">
            Request a reservation change
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-500">
            for <span className="font-semibold text-neutral-800">{title}</span>
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <DialogPanel className="p-10 text-center text-sm text-neutral-500">
            Loading reservation…
          </DialogPanel>
        ) : pendingChange ? (
          <>
            <DialogPanel className="p-6 pt-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3.5 text-sm text-amber-900">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">Change requested — pending CDM</p>
                  <p className="mt-0.5 opacity-90">
                    You asked to{" "}
                    {pendingChange.request_type === "cancel"
                      ? "cancel"
                      : "reschedule"}{" "}
                    this event. The outcome will appear in your timeline once
                    CDM resolves it.
                  </p>
                </div>
              </div>
            </DialogPanel>
            <DialogFooter
              className={cn(
                layout.actions,
                "border-t border-neutral-100 p-4 sm:p-6"
              )}
            >
              <DialogClose render={<Button variant="outline" type="button" />}>
                Close
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="contents">
            <div className="mx-6 flex items-start gap-2.5 rounded-xl border border-sky-200/70 bg-sky-50/70 p-3.5 text-sm text-sky-900">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <div>
                <p className="font-semibold">CDM reviews every request</p>
                <p className="mt-0.5 opacity-90">
                  Your suggested date is advisory — CDM may reschedule to
                  different slots or another room, cancel, or deny.
                </p>
              </div>
            </div>

            {windowClosed ? (
              <div className="mx-6 mt-3 flex items-start gap-2.5 rounded-xl border border-red-200/70 bg-red-50/70 p-3.5 text-sm text-red-900">
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">Request window closed</p>
                  <p className="mt-0.5 opacity-90">
                    Changes can only be requested up to the end of the event day
                    ({formatDisplayDate(dateOfEvent)}).
                  </p>
                </div>
              </div>
            ) : null}

            <DialogPanel className="space-y-4 p-6 pt-4">
              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">
                  What would you like to do?
                </span>
                <div
                  role="radiogroup"
                  aria-label="Change type"
                  className="grid grid-cols-2 gap-2"
                >
                  {REQUEST_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={requestType === option.value}
                      onClick={() => setRequestType(option.value)}
                      className={cn(
                        "min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors",
                        requestType === option.value
                          ? "border-[#8B0000] bg-[#8B0000]/5 text-[#8B0000]"
                          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-neutral-700">
                  Current holds
                </span>
                {holds.length === 0 ? (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 text-sm text-neutral-500">
                    No room or equipment holds on this paper.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {holds.map((hold, index) => (
                      <div
                        key={`${hold.reservable_id}-${index}`}
                        className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-neutral-800">
                            {hold.name}
                          </p>
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                              hold.type === "room"
                                ? "bg-sky-50 text-sky-700"
                                : "bg-violet-50 text-violet-700"
                            )}
                          >
                            {hold.type === "room" ? "Room" : "Equipment"}
                          </span>
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {(hold.selections ?? []).map((selection, selIndex) => (
                            <li
                              key={`${selection.date}-${selIndex}`}
                              className="text-xs text-neutral-600"
                            >
                              {formatDisplayDate(selection.date)} ·{" "}
                              {(selection.slots ?? [])
                                .map((slot) => slotLabel(slot))
                                .join(", ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {requestType === "reschedule" ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="reservation-suggested-date"
                    className="text-sm font-semibold text-neutral-700"
                  >
                    Suggested date{" "}
                    <span className="font-normal text-neutral-400">
                      (optional)
                    </span>
                  </label>
                  <DatePicker
                    id="reservation-suggested-date"
                    value={suggestedDate}
                    onChange={setSuggestedDate}
                    minDate={todayManila}
                    placeholder="Pick a preferred date"
                    disabled={windowClosed}
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label
                  htmlFor="reservation-reason"
                  className="text-sm font-semibold text-neutral-700"
                >
                  Reason <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="reservation-reason"
                  placeholder="Explain why you need to change this reservation…"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  maxLength={500}
                  rows={4}
                  disabled={windowClosed || storeMutation.isPending}
                  className="w-full resize-none text-sm"
                />
                <p className="text-right text-[11px] text-neutral-400">
                  {reason.length}/500
                </p>
              </div>
            </DialogPanel>

            <DialogFooter
              className={cn(
                layout.actions,
                "border-t border-neutral-100 p-4 pt-3 sm:p-6"
              )}
            >
              <DialogClose
                disabled={storeMutation.isPending}
                render={
                  <Button
                    variant="outline"
                    type="button"
                    disabled={storeMutation.isPending}
                  />
                }
              >
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={!canSubmit}
                variant={requestType === "cancel" ? "destructive" : "default"}
                className={cn(
                  "min-h-11 rounded-xl px-5 py-2 text-sm font-semibold",
                  requestType !== "cancel" &&
                    "bg-neutral-900 text-white hover:bg-black"
                )}
              >
                {storeMutation.isPending ? "Sending…" : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogPopup>
    </Dialog>
  )
}
