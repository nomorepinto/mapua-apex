import { useMemo, useState } from "react"
import {
  CalendarCheckIcon,
  LockIcon,
  Trash2Icon,
} from "lucide-react"

import {
  CampusSelect,
  ReservableSelect,
} from "@/components/admin/reservables/reservables-fields"
import { useReservablesPage } from "@/components/admin/reservables/reservables-context"
import { DaySlotGrid, SlotLegend } from "@/components/admin/reservables/schedule-grid"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toastManager } from "@/components/ui/toast"
import { layout } from "@/config"
import { mutationErrorMessage, useOrganizationsQuery } from "@/hooks/use-admin"
import { useAdminAvailabilityQuery } from "@/hooks/use-availability"
import { useReservableBookingsQuery } from "@/hooks/use-bookings"
import {
  formatDisplayDate,
  getDateKey,
  parseDateKey,
  startOfLocalDay,
} from "@/lib/date-key"
import { slotLabel } from "@/lib/schedule-slots"
import type { ApiBooking } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ReserveSection() {
  const { state, actions } = useReservablesPage()
  const {
    campuses,
    campusId,
    reservables,
    selectedReservableId,
    selectedReservable,
  } = state
  const { createBooking, deleteBooking } = actions

  const [reserveDate, setReserveDate] = useState<string>(() =>
    getDateKey(startOfLocalDay())
  )
  const [selectedSlots, setSelectedSlots] = useState<number[]>([])
  const [reason, setReason] = useState("")

  const availabilityQuery = useAdminAvailabilityQuery(
    campusId,
    selectedReservableId,
    reserveDate ? { start: reserveDate, end: reserveDate } : undefined
  )
  const availability = availabilityQuery.data ?? null

  const bookingsWindow = useMemo(() => {
    const start = startOfLocalDay()
    const end = new Date(start)
    end.setDate(end.getDate() + 150)
    return { start: getDateKey(start), end: getDateKey(end) }
  }, [])
  const bookingsQuery = useReservableBookingsQuery(
    campusId,
    selectedReservableId,
    bookingsWindow
  )
  const bookings = bookingsQuery.data ?? []

  const organizationsQuery = useOrganizationsQuery()
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const org of organizationsQuery.data ?? []) {
      map.set(org.organization_id, org.name)
    }
    return map
  }, [organizationsQuery.data])

  const manualBookings = bookings.filter((booking) => booking.source === "cdm")
  const submissionBookings = bookings.filter(
    (booking) => booking.source === "submission"
  )

  function toggleReserveSlot(slot: number) {
    setSelectedSlots((current) =>
      current.includes(slot)
        ? current.filter((item) => item !== slot)
        : [...current, slot].sort((a, b) => a - b)
    )
  }

  function changeDate(next: string) {
    setReserveDate(next)
    // Slots are date-specific, so a new date starts with a clean selection.
    setSelectedSlots([])
  }

  async function handleReserve() {
    if (!campusId || !selectedReservableId || !reserveDate || selectedSlots.length === 0) {
      return
    }
    try {
      await createBooking.mutateAsync({
        campusId,
        reservableId: selectedReservableId,
        selections: [{ date: reserveDate, slots: selectedSlots }],
        reason: reason.trim() || undefined,
      })
      toastManager.add({
        title: "Slot reserved",
        description: `${selectedReservable?.name ?? "Reservable"} held for ${formatDateLabel(
          reserveDate
        )}.`,
        type: "success",
      })
      setSelectedSlots([])
      setReason("")
    } catch (error) {
      // A 409 means the slot was just taken; keep the selection so CDM can pick
      // another time without re-entering everything.
      toastManager.add({
        title: "Could not reserve",
        description: mutationErrorMessage(error, "That slot may have just been taken."),
        type: "error",
      })
    }
  }

  async function handleRelease(booking: ApiBooking) {
    if (!campusId || !selectedReservableId) return
    try {
      await deleteBooking.mutateAsync({
        campusId,
        reservableId: selectedReservableId,
        bookingId: booking.booking_id,
      })
      toastManager.add({
        title: "Hold released",
        description: "The slots are available again.",
        type: "success",
      })
    } catch (error) {
      toastManager.add({
        title: "Could not release hold",
        description: mutationErrorMessage(error, "Request failed."),
        type: "error",
      })
    }
  }

  const canReserve =
    Boolean(campusId && selectedReservableId && reserveDate) &&
    selectedSlots.length > 0

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]",
        layout.gap
      )}
    >
      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Manual reservation</CardTitle>
          <CardDescription>
            Hold slots for a room or equipment. A manual hold blocks org
            submitters exactly like a submission booking.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <CampusSelect
            campuses={campuses}
            id="reserve-campus"
            onChange={actions.setCampusId}
            value={campusId}
          />
          <ReservableSelect
            id="reserve-reservable"
            onChange={(id) => {
              actions.setSelectedReservableId(id)
              setSelectedSlots([])
            }}
            reservables={reservables}
            value={selectedReservableId}
          />
          <Field>
            <FieldLabel htmlFor="reserve-date">Date</FieldLabel>
            <DatePicker
              id="reserve-date"
              minDate={startOfLocalDay()}
              onChange={changeDate}
              value={reserveDate}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reserve-reason">Purpose (optional)</FieldLabel>
            <Input
              autoComplete="off"
              id="reserve-reason"
              maxLength={255}
              onChange={(event) => setReason(event.currentTarget.value)}
              placeholder="Maintenance, exam proctoring, …"
              type="text"
              value={reason}
            />
            <FieldDescription>Shown to CDM only; not part of any paper.</FieldDescription>
          </Field>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <span className="font-semibold text-neutral-900">
              {selectedSlots.length}
            </span>{" "}
            <span className="text-neutral-600">
              slot{selectedSlots.length === 1 ? "" : "s"} selected
              {selectedSlots.length > 0
                ? ` · ${selectedSlots.map(slotLabel).join(", ")}`
                : ""}
            </span>
          </div>
          <Button
            disabled={!canReserve}
            loading={createBooking.isPending}
            onClick={handleReserve}
            type="button"
          >
            <CalendarCheckIcon aria-hidden="true" />
            Reserve slots
          </Button>
        </CardPanel>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className={cn(layout.card, "min-w-0")}>
          <CardHeader>
            <CardTitle>
              {reserveDate ? formatDateLabel(reserveDate) : "Pick a date"}
            </CardTitle>
            <CardDescription>
              Only free slots can be selected; booked and closed slots are
              disabled.
            </CardDescription>
          </CardHeader>
          <CardPanel className="flex flex-col gap-3">
            {!selectedReservable ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarCheckIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No reservable selected</EmptyTitle>
                  <EmptyDescription>
                    Choose a campus and a reservable to reserve its slots.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : availabilityQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <SlotLegend />
                {reserveDate ? (
                  <DaySlotGrid
                    availability={availability}
                    date={reserveDate}
                    mode="select"
                    onToggleSlot={toggleReserveSlot}
                    selectedSlots={selectedSlots}
                  />
                ) : null}
              </>
            )}
          </CardPanel>
        </Card>

        <Card className={cn(layout.card, "min-w-0")}>
          <CardHeader>
            <CardTitle>Existing holds</CardTitle>
            <CardDescription>
              Release manual holds you created. Submission holds are read-only —
              they are released by deny, return, or re-edit.
            </CardDescription>
          </CardHeader>
          <CardPanel className="p-0">
            {bookingsQuery.isLoading ? (
              <div className="space-y-2 px-4 pb-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : bookings.length === 0 ? (
              <Empty className="py-8">
                <EmptyHeader>
                  <EmptyTitle>No holds in range</EmptyTitle>
                  <EmptyDescription>
                    Nothing is booked for this reservable in the next 150 days.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-200">
                {[...manualBookings, ...submissionBookings].map((booking) => (
                  <BookingRow
                    booking={booking}
                    key={booking.booking_id}
                    onRelease={handleRelease}
                    orgName={
                      booking.organization_id
                        ? (orgNameById.get(booking.organization_id) ??
                          "an organization")
                        : null
                    }
                    releasePending={deleteBooking.isPending}
                  />
                ))}
              </ul>
            )}
          </CardPanel>
        </Card>
      </div>
    </div>
  )
}

function BookingRow({
  booking,
  orgName,
  onRelease,
  releasePending,
}: {
  booking: ApiBooking
  orgName: string | null
  onRelease: (booking: ApiBooking) => void
  releasePending: boolean
}) {
  const isManual = booking.source === "cdm"

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          isManual ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
        )}
      >
        {isManual ? (
          <CalendarCheckIcon aria-hidden="true" className="size-4" />
        ) : (
          <LockIcon aria-hidden="true" className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-neutral-900">
            {isManual ? "Manual hold" : `Submission · ${orgName ?? "organization"}`}
          </span>
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              isManual ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
            )}
          >
            {isManual ? "CDM" : "Org"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-600">
          {formatSelections(booking)}
        </p>
        {booking.reason ? (
          <p className="mt-0.5 text-xs text-neutral-500 italic">
            “{booking.reason}”
          </p>
        ) : null}
      </div>
      {isManual ? (
        <Button
          aria-label="Release hold"
          loading={releasePending}
          onClick={() => onRelease(booking)}
          size="sm"
          type="button"
          variant="destructive-outline"
        >
          <Trash2Icon />
          Release
        </Button>
      ) : null}
    </li>
  )
}

function formatDateLabel(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return date ? formatDisplayDate(date, "long") : dateKey
}

function formatSelections(booking: ApiBooking): string {
  const parts = (booking.schedule_selected ?? []).map((selection) => {
    const slots = [...(selection.slots ?? [])].sort((a, b) => a - b)
    return `${formatDateLabel(selection.date)} · ${slots.map(slotLabel).join(", ")}`
  })
  return parts.length > 0 ? parts.join(" | ") : "No slots recorded."
}
