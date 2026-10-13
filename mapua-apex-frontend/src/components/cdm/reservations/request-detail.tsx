import { useMemo, useState } from "react"
import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  XCircle,
} from "lucide-react"

import { ReservableSelect } from "@/components/admin/reservables/reservables-fields"
import {
  AvailabilityLegend,
  DaySlotGrid,
  SlotLegend,
  availabilityDayModifiers,
} from "@/components/admin/reservables/schedule-grid"
import {
  CancelReservationDialog,
  DenyReservationDialog,
  RescheduleReservationDialog,
} from "@/components/cdm/reservations/resolve-dialogs"
import { useReservationsPage } from "@/components/cdm/reservations/reservations-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { toastManager } from "@/components/ui/toast"
import { layout } from "@/config"
import { mutationErrorMessage } from "@/hooks/use-admin"
import { useAdminAvailabilityQuery } from "@/hooks/use-availability"
import { formatDisplayDateTime } from "@/lib/dynamodb-adapters"
import {
  formatDisplayDate as formatLongDate,
  getDateKey,
  parseDateKey,
  startOfLocalDay,
} from "@/lib/date-key"
import { slotLabel } from "@/lib/schedule-slots"
import type {
  ApiReservable,
  ApiReservationChange,
  AppliedBookingAction,
  AppliedHoldSnapshot,
  ReservationChangeBooking,
  ReservationChangeDecision,
  ResolveBookingInstruction,
  SlotSelection,
} from "@/lib/types"
import { cn } from "@/lib/utils"

/** Composite id for one snapshotted hold (`pk` + `sk` are both needed). */
function holdKey(pk: string, sk: string): string {
  return `${pk}|${sk}`
}

function formatDateKey(value?: string | null): string {
  if (!value) return "—"
  const date = parseDateKey(value)
  return date ? formatLongDate(date, "long") : value
}

function formatSelections(selections: SlotSelection[] | undefined): string {
  const parts = (selections ?? []).map((selection) => {
    const slots = [...(selection.slots ?? [])].sort((a, b) => a - b)
    return `${formatDateKey(selection.date)} · ${
      slots.length > 0 ? slots.map(slotLabel).join(", ") : "no slots"
    }`
  })
  return parts.length > 0 ? parts.join(" | ") : "No slots recorded."
}

/** CDM's in-progress edit of one hold: keep as-is, or change date/slots/room. */
interface HoldDraft {
  mode: "keep" | "change"
  reservableId: string | null
  date: string
  slots: number[]
}

function initialDrafts(change: ApiReservationChange): Record<string, HoldDraft> {
  const drafts: Record<string, HoldDraft> = {}
  for (const booking of change.bookings) {
    const first = booking.schedule_selected?.[0]
    drafts[holdKey(booking.pk, booking.sk)] = {
      mode: "keep",
      reservableId: booking.reservable_id,
      date: first?.date ?? "",
      slots: first?.slots ? [...first.slots].sort((a, b) => a - b) : [],
    }
  }
  return drafts
}

/**
 * Right column: the selected request. Pending requests render the resolution
 * editor (one card per snapshotted hold + Cancel/Reschedule/Deny); resolved or
 * denied requests render the read-only `applied` audit trail.
 */
export function RequestDetail() {
  const { state } = useReservationsPage()
  const { selectedChange, selectedChangeLoading, selectedChangeId } = state

  if (!selectedChangeId) {
    return (
      <Card className={cn(layout.card, "min-w-0")}>
        <CardPanel>
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No request selected</EmptyTitle>
              <EmptyDescription>
                Pick a request from the queue to review its holds and resolve
                it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardPanel>
      </Card>
    )
  }

  if (selectedChangeLoading || !selectedChange) {
    return (
      <Card className={cn(layout.card, "min-w-0")}>
        <CardPanel className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardPanel>
      </Card>
    )
  }

  if (selectedChange.status === "pending") {
    return <PendingDetail change={selectedChange} key={selectedChange.change_id ?? "pending"} />
  }

  return <ResolvedDetail change={selectedChange} />
}

/* -------------------------------------------------------------------------- */
/* Pending — resolution editor                                                 */
/* -------------------------------------------------------------------------- */

function PendingDetail({ change }: { change: ApiReservationChange }) {
  const { state, actions } = useReservationsPage()
  const { campusId, reservables } = state
  const resolve = actions.resolve

  const changeId = change.change_id
  const [drafts, setDrafts] = useState<Record<string, HoldDraft>>(() =>
    initialDrafts(change)
  )
  const [dialog, setDialog] = useState<"cancel" | "deny" | "reschedule" | null>(
    null
  )

  const reservableNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const reservable of reservables) {
      map.set(reservable.reservable_id, reservable.name)
    }
    return map
  }, [reservables])

  function patchDraft(booking: ReservationChangeBooking, patch: Partial<HoldDraft>) {
    setDrafts((current) => {
      const key = holdKey(booking.pk, booking.sk)
      const existing = current[key]
      if (!existing) return current
      return { ...current, [key]: { ...existing, ...patch } }
    })
  }

  const changedBookings = change.bookings.filter(
    (booking) => drafts[holdKey(booking.pk, booking.sk)]?.mode === "change"
  )
  const canReschedule =
    changedBookings.length > 0 &&
    changedBookings.every((booking) => {
      const draft = drafts[holdKey(booking.pk, booking.sk)]
      return (
        Boolean(draft?.reservableId) &&
        Boolean(draft?.date) &&
        (draft?.slots.length ?? 0) > 0
      )
    })

  function buildInstructions(): ResolveBookingInstruction[] {
    return change.bookings.map((booking) => {
      const key = holdKey(booking.pk, booking.sk)
      const draft = drafts[key]
      if (!draft || draft.mode === "keep") {
        return { pk: booking.pk, sk: booking.sk, action: "keep" as const }
      }
      const selections: SlotSelection[] = [
        { date: draft.date, slots: [...draft.slots].sort((a, b) => a - b) },
      ]
      if (draft.reservableId && draft.reservableId !== booking.reservable_id) {
        return {
          pk: booking.pk,
          sk: booking.sk,
          action: "swap" as const,
          selections,
          new_reservable_id: draft.reservableId,
        }
      }
      return {
        pk: booking.pk,
        sk: booking.sk,
        action: "update" as const,
        selections,
      }
    })
  }

  const cancelHoldLines = change.bookings.map(
    (booking) =>
      `${booking.reservable_name ?? "Hold"} — ${formatSelections(
        booking.schedule_selected
      )}`
  )

  const rescheduleLines = change.bookings.map((booking) => {
    const draft = drafts[holdKey(booking.pk, booking.sk)]
    const name = booking.reservable_name ?? "Hold"
    if (!draft || draft.mode === "keep") return `${name}: unchanged`
    const when = `${formatDateKey(draft.date)} · ${
      draft.slots.length > 0
        ? [...draft.slots].sort((a, b) => a - b).map(slotLabel).join(", ")
        : "no slots"
    }`
    const swapped =
      draft.reservableId && draft.reservableId !== booking.reservable_id
    const target = swapped
      ? (reservableNameById.get(draft.reservableId as string) ?? "another reservable")
      : name
    return `${name} → ${target}: ${when}`
  })

  async function submitResolve(
    decision: ReservationChangeDecision,
    comment: string,
    bookings?: ResolveBookingInstruction[]
  ) {
    if (!campusId || !changeId) return
    try {
      await resolve.mutateAsync({
        campusId,
        changeId,
        decision,
        comment: comment.trim() || undefined,
        bookings,
      })
      toastManager.add({
        title:
          decision === "deny"
            ? "Request denied"
            : decision === "cancel"
              ? "Event cancelled"
              : "Event rescheduled",
        description: "The student has been notified in their timeline.",
        type: "success",
      })
      setDialog(null)
      actions.selectChange(null)
    } catch (error) {
      toastManager.add({
        title: "Could not resolve request",
        description: mutationErrorMessage(error, "Please try again."),
        type: "error",
      })
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <EventSummaryCard change={change} />

      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Student request</CardTitle>
          <CardDescription>
            {change.request_type === "cancel"
              ? "The student asked to cancel this event."
              : "The student asked to reschedule this event."}
            {change.requested_at ? ` Sent ${formatDisplayDateTime(change.requested_at)}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={change.request_type === "cancel" ? "destructive" : "info"}>
              {change.request_type === "cancel" ? "Cancel request" : "Reschedule request"}
            </Badge>
            {change.suggested_date ? (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Suggested {formatDateKey(change.suggested_date)}
              </span>
            ) : null}
          </div>
          {change.reason ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              “{change.reason}”
            </p>
          ) : null}
        </CardPanel>
      </Card>

      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Holds targeted by this request</CardTitle>
          <CardDescription>
            Keep a hold unchanged, or change its date/slots — and optionally move
            it to another room or equipment. Every changed hold must have a date
            and at least one free slot.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-3">
          {change.bookings.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
              This request has no snapshotted holds.
            </p>
          ) : (
            change.bookings.map((booking) => (
              <HoldEditor
                booking={booking}
                campusId={campusId}
                draft={drafts[holdKey(booking.pk, booking.sk)]}
                key={holdKey(booking.pk, booking.sk)}
                onChange={(patch) => patchDraft(booking, patch)}
                reservables={reservables}
              />
            ))
          )}
        </CardPanel>
      </Card>

      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Resolution</CardTitle>
          <CardDescription>
            Rescheduling applies your edits above; cancelling releases every
            hold and marks the paper cancelled; denying leaves everything
            untouched. All three notify the student.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            disabled={!canReschedule || resolve.isPending}
            onClick={() => setDialog("reschedule")}
            type="button"
          >
            <CalendarCheck aria-hidden="true" />
            Apply reschedule
          </Button>
          <Button
            disabled={resolve.isPending}
            onClick={() => setDialog("cancel")}
            type="button"
            variant="destructive-outline"
          >
            <Ban aria-hidden="true" />
            Cancel event
          </Button>
          <Button
            disabled={resolve.isPending}
            onClick={() => setDialog("deny")}
            type="button"
            variant="outline"
          >
            <XCircle aria-hidden="true" />
            Deny
          </Button>
        </CardPanel>
      </Card>

      <RescheduleReservationDialog
        isPending={resolve.isPending}
        lines={rescheduleLines}
        onConfirm={(comment) =>
          submitResolve("reschedule", comment, buildInstructions())
        }
        onOpenChange={(open) => setDialog(open ? "reschedule" : null)}
        open={dialog === "reschedule"}
      />
      <CancelReservationDialog
        holds={cancelHoldLines}
        isPending={resolve.isPending}
        onConfirm={(comment) => submitResolve("cancel", comment)}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        open={dialog === "cancel"}
      />
      <DenyReservationDialog
        isPending={resolve.isPending}
        onConfirm={(comment) => submitResolve("deny", comment)}
        onOpenChange={(open) => setDialog(open ? "deny" : null)}
        open={dialog === "deny"}
      />
    </div>
  )
}

function HoldEditor({
  booking,
  draft,
  reservables,
  campusId,
  onChange,
}: {
  booking: ReservationChangeBooking
  draft: HoldDraft | undefined
  reservables: ApiReservable[]
  campusId: string | null
  onChange: (patch: Partial<HoldDraft>) => void
}) {
  const mode = draft?.mode ?? "keep"
  const reservableId = draft?.reservableId ?? booking.reservable_id
  const date = draft?.date ?? ""
  const slots = draft?.slots ?? []

  // Only fetch availability while editing; a kept hold needs no grid.
  const availabilityWindow = useMemo(() => {
    const start = startOfLocalDay()
    const end = new Date(start)
    end.setDate(end.getDate() + 180)
    return { start: getDateKey(start), end: getDateKey(end) }
  }, [])
  const availabilityQuery = useAdminAvailabilityQuery(
    campusId,
    mode === "change" ? reservableId : null,
    availabilityWindow
  )
  const availability = availabilityQuery.data ?? null
  const { modifiers, modifiersClassNames } = useMemo(
    () => availabilityDayModifiers(availability),
    [availability]
  )

  // A swap must keep the same reservable type (room → room, equipment →
  // equipment), so the picker only offers matching reservables.
  const sameTypeReservables = reservables.filter(
    (item) => item.type === booking.reservable_type
  )

  function toggleSlot(slot: number) {
    const next = slots.includes(slot)
      ? slots.filter((item) => item !== slot)
      : [...slots, slot].sort((a, b) => a - b)
    onChange({ slots: next })
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-900">
            {booking.reservable_name ?? "Hold"}
          </p>
          <p className="text-xs text-neutral-500">
            {booking.reservable_type === "equipment" ? "Equipment" : "Room"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            aria-pressed={mode === "keep"}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
              mode === "keep"
                ? "border-neutral-800 bg-neutral-800 text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
            onClick={() => onChange({ mode: "keep" })}
            type="button"
          >
            Keep
          </button>
          <button
            aria-pressed={mode === "change"}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
              mode === "change"
                ? "border-[#8B0000] bg-[#8B0000] text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
            onClick={() => onChange({ mode: "change" })}
            type="button"
          >
            Change
          </button>
        </div>
      </div>

      {mode === "keep" ? (
        <p className="mt-2 text-xs text-neutral-600">
          {formatSelections(booking.schedule_selected)}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <ReservableSelect
            id={`hold-reservable-${booking.sk}`}
            label="Room / equipment"
            onChange={(id) => onChange({ reservableId: id, slots: [] })}
            reservables={sameTypeReservables}
            value={reservableId}
          />
          <Field>
            <FieldLabel htmlFor={`hold-date-${booking.sk}`}>Date</FieldLabel>
            <DatePicker
              id={`hold-date-${booking.sk}`}
              legend={<AvailabilityLegend />}
              minDate={startOfLocalDay()}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              onChange={(next) => onChange({ date: next, slots: [] })}
              value={date}
            />
          </Field>
          {availabilityQuery.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <SlotLegend />
              {date ? (
                <DaySlotGrid
                  availability={availability}
                  date={date}
                  mode="select"
                  onToggleSlot={toggleSlot}
                  selectedSlots={slots}
                />
              ) : (
                <p className="text-xs text-neutral-500">Pick a date to see slots.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Event summary + resolved audit                                              */
/* -------------------------------------------------------------------------- */

function EventSummaryCard({ change }: { change: ApiReservationChange }) {
  const submission = change.submission
  const details = submission?.activity_details
  const title =
    details?.title_and_nature || change.event_title || change.submission_id || "Event"

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {submission?.organization_name ?? change.organization_name ?? "Organization"}
        </CardDescription>
      </CardHeader>
      <CardPanel className="grid grid-cols-1 gap-2 text-sm text-neutral-700 sm:grid-cols-2">
        <SummaryLine icon={<CalendarDays aria-hidden="true" className="size-4" />} label="Date">
          {formatDateKey(details?.date_of_event)}
        </SummaryLine>
        <SummaryLine icon={<Clock aria-hidden="true" className="size-4" />} label="Time">
          {details?.time_of_event || "—"}
        </SummaryLine>
        <SummaryLine icon={<MapPin aria-hidden="true" className="size-4" />} label="Venue">
          {details?.venue || "—"}
        </SummaryLine>
        <SummaryLine icon={<Users aria-hidden="true" className="size-4" />} label="Expected">
          {details?.expected_participants != null
            ? `${details.expected_participants} participants`
            : "—"}
        </SummaryLine>
      </CardPanel>
    </Card>
  )
}

function SummaryLine({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-neutral-400">{icon}</span>
      <span className="min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {label}
        </span>
        <span className="block truncate text-neutral-800">{children}</span>
      </span>
    </div>
  )
}

const APPLIED_ACTION_META: Record<
  AppliedBookingAction,
  { label: string; variant: "destructive" | "secondary" | "info" | "warning" }
> = {
  released: { label: "Released", variant: "destructive" },
  kept: { label: "Kept", variant: "secondary" },
  updated: { label: "Updated", variant: "info" },
  replaced: { label: "Replaced", variant: "warning" },
}

const DECISION_META: Record<
  string,
  { label: string; variant: "destructive" | "success" | "secondary" }
> = {
  cancel: { label: "Cancelled", variant: "destructive" },
  reschedule: { label: "Rescheduled", variant: "success" },
  deny: { label: "Denied", variant: "secondary" },
}

function ResolvedDetail({ change }: { change: ApiReservationChange }) {
  const { state } = useReservationsPage()
  const reservableNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const reservable of state.reservables) {
      map.set(reservable.reservable_id, reservable.name)
    }
    return map
  }, [state.reservables])

  const decision = change.decision ? DECISION_META[change.decision] : null
  const applied = change.applied
  const submissionEntry = applied?.submission ?? null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <EventSummaryCard change={change} />

      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Resolution</CardTitle>
          <CardDescription>
            {change.resolved_at ? `Resolved ${formatDisplayDateTime(change.resolved_at)}.` : "Resolved."}
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {decision ? (
              <Badge variant={decision.variant}>{decision.label}</Badge>
            ) : null}
            <Badge variant="outline">
              {change.request_type === "cancel" ? "Cancel request" : "Reschedule request"}
            </Badge>
          </div>
          {change.comment ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              “{change.comment}”
            </p>
          ) : null}
        </CardPanel>
      </Card>

      {submissionEntry ? (
        <Card className={cn(layout.card, "min-w-0")}>
          <CardHeader>
            <CardTitle>Paper changes</CardTitle>
          </CardHeader>
          <CardPanel className="flex flex-col gap-2 text-sm">
            <AuditLine label="Status">
              {submissionEntry.status_before ?? "—"} → {submissionEntry.status_after ?? "—"}
            </AuditLine>
            {submissionEntry.date_of_event_before || submissionEntry.date_of_event_after ? (
              <AuditLine label="Date of event">
                {formatDateKey(submissionEntry.date_of_event_before)} →{" "}
                {formatDateKey(submissionEntry.date_of_event_after)}
              </AuditLine>
            ) : null}
            {submissionEntry.time_of_event_before || submissionEntry.time_of_event_after ? (
              <AuditLine label="Time of event">
                {submissionEntry.time_of_event_before ?? "—"} →{" "}
                {submissionEntry.time_of_event_after ?? "—"}
              </AuditLine>
            ) : null}
          </CardPanel>
        </Card>
      ) : null}

      {applied && applied.bookings.length > 0 ? (
        <Card className={cn(layout.card, "min-w-0")}>
          <CardHeader>
            <CardTitle>Booking audit trail</CardTitle>
            <CardDescription>
              What the resolution did to each targeted hold.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-3">
            {applied.bookings.map((entry, index) => {
              const meta = APPLIED_ACTION_META[entry.action]
              return (
                <div
                  className="rounded-xl border border-neutral-200 bg-white p-3"
                  key={`${entry.sk}-${index}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-800">
                      {(entry.before?.reservable_id &&
                        reservableNameById.get(entry.before.reservable_id)) ||
                        (entry.after?.reservable_id &&
                          reservableNameById.get(entry.after.reservable_id)) ||
                        "Hold"}
                    </span>
                    {meta ? (
                      <Badge size="sm" variant={meta.variant}>
                        {meta.label}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-neutral-600 sm:grid-cols-2">
                    <div>
                      <span className="font-semibold uppercase tracking-wide text-neutral-400">
                        Before
                      </span>
                      <p>{formatSnapshot(entry.before, reservableNameById)}</p>
                    </div>
                    <div>
                      <span className="font-semibold uppercase tracking-wide text-neutral-400">
                        After
                      </span>
                      <p>{formatSnapshot(entry.after, reservableNameById)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardPanel>
        </Card>
      ) : null}
    </div>
  )
}

function AuditLine({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className="text-neutral-800">{children}</span>
    </div>
  )
}

function formatSnapshot(
  snapshot: AppliedHoldSnapshot | null,
  nameById: Map<string, string>
): string {
  if (!snapshot) return "—"
  const name =
    (snapshot.reservable_id && nameById.get(snapshot.reservable_id)) || "Hold"
  return `${name} — ${formatSelections(snapshot.schedule_selected)}`
}
