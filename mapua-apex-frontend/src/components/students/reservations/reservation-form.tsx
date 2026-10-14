import { useMemo, useState, type ReactNode } from "react"
import { BoxesIcon, CalendarDaysIcon, Trash2Icon } from "lucide-react"

import {
  AvailabilityLegend,
  DaySlotGrid,
  SlotLegend,
  availabilityDayModifiers,
} from "@/components/admin/reservables/schedule-grid"
import { FieldWarning } from "@/components/forms/field-warning"
import { useReservationFormContext } from "@/components/students/reservations/reservation-context"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useStudentAvailabilityQuery } from "@/hooks/use-availability"
import { useStudentCampusesQuery } from "@/hooks/use-campuses"
import { useStudentReservablesQuery } from "@/hooks/use-reservables"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import {
  addDays,
  formatDisplayDate,
  getDateKey,
  minEventDate,
  minEventDateKey,
  parseDateKey,
} from "@/lib/date-key"
import { slotLabel } from "@/lib/schedule-slots"
import { capacityRangeLabel, withinCapacity } from "@/lib/reservable-capacity"
import type { ApiReservable } from "@/lib/types"
import type { ReservationPick } from "@/components/reservation/types"
import { cn } from "@/lib/utils"

/**
 * The reservation step of the SAAF wizard. The proponent picks a campus (which
 * is also the event venue), adds the rooms/equipment to reserve, then chooses
 * concrete dates and 70-minute slots from live availability. The event's date
 * and time are derived from those selections (see `use-reservation-form`), so
 * this step owns them and the Activity step shows them read-only.
 *
 * This is form-less (no nested `<form>`): the wizard wraps every step in a
 * single `fetcher.Form`, and the hidden inputs below carry the derived values
 * so native required-field validity still gates the step.
 */
export function ReservationFields() {
  const { state, actions } = useReservationFormContext()
  const { draft, campusId } = state
  const { state: saafState, actions: saafActions } = useSaafFormContext()
  const { draft: saafDraft } = saafState

  const campusesQuery = useStudentCampusesQuery()
  const campuses = campusesQuery.data ?? []
  const selectedCampus = campuses.find((c) => c.campus_id === campusId) ?? null

  const picks = draft.picks

  return (
    <div className="space-y-8">
      <div className="space-y-0.5">
        <h2 className="text-sm font-bold tracking-wide text-neutral-900 uppercase">
          Application form on use of facilities
        </h2>
        <p className="text-xs font-semibold text-neutral-800">
          Reserve rooms and equipment by picking the dates and time slots you
          need.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full space-y-1.5 sm:w-72">
          <label className="block text-xs font-semibold text-neutral-800">
            Venue Campus <span className="text-red-500">*</span>
          </label>
          <Select
            value={campusId || null}
            // Provide the value→label map so the trigger shows the campus name
            // even before the popup mounts (the campus id is restored from the
            // persisted draft, so Base UI would otherwise stringify the UUID).
            items={campuses.map((campus) => ({ value: campus.campus_id, label: campus.name }))}
            onValueChange={(value: string | null) => {
              const campus = campuses.find((c) => c.campus_id === value)
              if (campus) actions.handleSelectCampus(campus.campus_id, campus.name)
            }}
          >
            <SelectTrigger
              aria-label="Venue Campus"
              className={cn(
                "h-10 w-full truncate rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900",
                !campusId && "saaf-glow-invalid"
              )}
            >
              <SelectValue placeholder="Select campus" />
            </SelectTrigger>
            <SelectPopup>
              {campuses.map((campus) => (
                <SelectItem key={campus.campus_id} value={campus.campus_id}>
                  {campus.name}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <FieldWarning name="activityVenue" />
        </div>

        <div className="w-full shrink-0 space-y-1.5 sm:w-64">
          <label className="block text-xs font-semibold text-neutral-800">
            Number of Expected Participants <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="expectedParticipants"
            placeholder="0"
            maxLength={4}
            value={saafDraft.expectedParticipants}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) =>
              saafActions.updateField(
                "expectedParticipants",
                sanitizeIntegerInput(e.target.value).slice(0, 4)
              )
            }
            style={{ color: "#171717" }}
            className="no-spinner h-9.5 rounded-lg border-neutral-300 bg-white !text-neutral-900 placeholder:text-neutral-400"
            required
          />
          <span className="block text-[10px] text-neutral-500">
            Between 20 and 3,000 participants
          </span>
          <FieldWarning name="expectedParticipants" />
        </div>
      </div>

      <ReservablePicker
        campusId={campusId}
        campusName={selectedCampus?.name ?? ""}
        onToggle={actions.handleTogglePick}
        picks={picks}
      />

      {picks.length > 0 ? (
        <div className="space-y-4">
          {picks.map((pick) => (
            <PickCard
              campusId={campusId}
              expectedParticipants={saafDraft.expectedParticipants}
              key={pick.id}
              onRemove={actions.handleRemovePick}
              onToggleSlot={actions.handleToggleSlot}
              onUpdateRemarks={actions.handleUpdateRemarks}
              pick={pick}
            />
          ))}
        </div>
      ) : null}

      <EventScheduleSummary
        dateOfEvent={saafDraft.dateOfEvent}
        endDateOfEvent={saafDraft.endDateOfEvent}
        timeOfEvent={saafDraft.timeOfEvent}
      />

      {/* Derived values carried for native required-field validity. */}
      <input type="hidden" name="activityVenue" value={saafDraft.activityVenue} required />
      <input type="hidden" name="dateOfEvent" value={saafDraft.dateOfEvent} required />
      <input
        type="hidden"
        name="endDateOfEvent"
        value={saafDraft.endDateOfEvent || saafDraft.dateOfEvent}
        required
      />
      <input type="hidden" name="timeOfEvent" value={saafDraft.timeOfEvent} required />
      <input type="hidden" name="timeOfEventStart" value={saafDraft.timeOfEventStart || ""} />
      <input type="hidden" name="timeOfEventEnd" value={saafDraft.timeOfEventEnd || ""} />
      <input type="hidden" name="dayOfEvent" value={saafDraft.dayOfEvent || ""} />
      <FieldWarning name="dateOfEvent" />
      <FieldWarning name="endDateOfEvent" />
      <FieldWarning name="timeOfEvent" />
    </div>
  )
}

/** Rooms + equipment the chosen campus lends out, as add/remove toggles. */
function ReservablePicker({
  campusId,
  campusName,
  picks,
  onToggle,
}: {
  campusId: string
  campusName: string
  picks: ReservationPick[]
  onToggle: (reservable: ApiReservable) => void
}) {
  const reservablesQuery = useStudentReservablesQuery(campusId || null)
  const reservables = reservablesQuery.data ?? []
  const pickedIds = useMemo(
    () => new Set(picks.map((pick) => pick.reservable_id)),
    [picks]
  )

  if (!campusId) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
        Select a venue campus to see the rooms and equipment you can reserve.
      </p>
    )
  }

  const rooms = reservables.filter((item) => item.type === "room")
  const equipment = reservables.filter((item) => item.type === "equipment")

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-neutral-800 uppercase">
          Rooms &amp; equipment
        </h3>
        <p className="text-[11px] text-neutral-500">
          {campusName ? `${campusName} · ` : ""}
          Tap to add or remove. You pick dates and slots for each below.
        </p>
      </div>

      {reservablesQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : reservables.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          This campus has no reservables yet. Please check back later.
        </p>
      ) : (
        <div className="space-y-4">
          <ReservableGroup
            icon={<CalendarDaysIcon aria-hidden="true" className="size-4" />}
            label="Rooms"
            onToggle={onToggle}
            pickedIds={pickedIds}
            reservables={rooms}
          />
          <ReservableGroup
            icon={<BoxesIcon aria-hidden="true" className="size-4" />}
            label="Equipment"
            onToggle={onToggle}
            pickedIds={pickedIds}
            reservables={equipment}
          />
        </div>
      )}
    </div>
  )
}

function ReservableGroup({
  label,
  icon,
  reservables,
  pickedIds,
  onToggle,
}: {
  label: string
  icon: ReactNode
  reservables: ApiReservable[]
  pickedIds: Set<string>
  onToggle: (reservable: ApiReservable) => void
}) {
  if (reservables.length === 0) return null
  return (
    <div className="space-y-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
        {icon}
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {reservables.map((reservable) => {
          const picked = pickedIds.has(reservable.reservable_id)
          return (
            <button
              aria-pressed={picked}
              className={cn(
                "flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                picked
                  ? "border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50"
              )}
              key={reservable.reservable_id}
              onClick={() => onToggle(reservable)}
              type="button"
            >
              <span className="truncate">{reservable.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Date + slot picker for one reservable, driven by its live availability. */
function PickCard({
  pick,
  campusId,
  expectedParticipants,
  onToggleSlot,
  onUpdateRemarks,
  onRemove,
}: {
  pick: ReservationPick
  campusId: string
  expectedParticipants: string
  onToggleSlot: (pickId: string, date: string, slot: number) => void
  onUpdateRemarks: (pickId: string, remarks: string) => void
  onRemove: (pickId: string) => void
}) {
  const [date, setDate] = useState<string>(() => minEventDateKey())

  // Reserve from the earliest allowed event date through ~6 months out.
  const window = useMemo(() => {
    const start = minEventDate()
    return { start: getDateKey(start), end: getDateKey(addDays(start, 180)) }
  }, [])

  const availabilityQuery = useStudentAvailabilityQuery(
    campusId || null,
    pick.reservable_id,
    window
  )
  const availability = availabilityQuery.data ?? null

  const { modifiers, modifiersClassNames } = useMemo(
    () => availabilityDayModifiers(availability),
    [availability]
  )

  const selectedForDate = pick.selections.find((s) => s.date === date)?.slots ?? []
  const totalSlots = pick.selections.reduce(
    (sum, selection) => sum + selection.slots.length,
    0
  )

  // Room participant bounds: show the range, and flag when the expected
  // headcount falls outside it (the same rule the API enforces on submit).
  const bounds = { min: pick.min_participants, max: pick.max_participants }
  const range = pick.type === "room" ? capacityRangeLabel(bounds) : ""
  const headcount =
    expectedParticipants.trim() === "" ? null : Number(expectedParticipants)
  const capacityViolated =
    range !== "" &&
    headcount !== null &&
    Number.isFinite(headcount) &&
    !withinCapacity(bounds, headcount)

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-neutral-900">
            {pick.name}
          </h4>
          <p className="text-[11px] text-neutral-500 capitalize">{pick.type}</p>
          {range ? (
            <p
              className={cn(
                "text-[11px]",
                capacityViolated ? "font-semibold text-red-600" : "text-neutral-500"
              )}
            >
              Capacity: {range} participants
              {capacityViolated
                ? ` · expected ${expectedParticipants} is outside this range`
                : ""}
            </p>
          ) : null}
        </div>
        <Button
          aria-label={`Remove ${pick.name}`}
          onClick={() => onRemove(pick.id)}
          size="sm"
          type="button"
          variant="destructive-outline"
        >
          <Trash2Icon />
          Remove
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div className="space-y-3">
          <DatePicker
            aria-label={`Reservation date for ${pick.name}`}
            minDate={minEventDate()}
            onChange={setDate}
            value={date}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            legend={<AvailabilityLegend />}
          />
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-neutral-600">
              Purpose (optional)
            </label>
            <Input
              autoComplete="off"
              maxLength={120}
              onChange={(e) => onUpdateRemarks(pick.id, e.currentTarget.value)}
              placeholder="Rehearsal, seminar, …"
              type="text"
              value={pick.remarks}
            />
          </div>
          <SelectedSummary pick={pick} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-700">
              {formatDateLabel(date)}
            </span>
            <SlotLegend />
          </div>
          {availabilityQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <DaySlotGrid
              availability={availability}
              date={date}
              mode="select"
              onToggleSlot={(slot) => onToggleSlot(pick.id, date, slot)}
              selectedSlots={selectedForDate}
            />
          )}
          <p className="text-[11px] text-neutral-500">
            {totalSlots} slot{totalSlots === 1 ? "" : "s"} reserved for{" "}
            {pick.name}.
          </p>
        </div>
      </div>
    </div>
  )
}

function SelectedSummary({ pick }: { pick: ReservationPick }) {
  if (pick.selections.length === 0) {
    return (
      <p className="text-[11px] text-neutral-400">
        No slots selected yet — pick a date and time on the right.
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {pick.selections.map((selection) => (
        <li className="text-[11px] text-neutral-600" key={selection.date}>
          <span className="font-semibold text-neutral-800">
            {formatDateLabel(selection.date)}
          </span>{" "}
          · {[...selection.slots].sort((a, b) => a - b).map(slotLabel).join(", ")}
        </li>
      ))}
    </ul>
  )
}

function EventScheduleSummary({
  dateOfEvent,
  endDateOfEvent,
  timeOfEvent,
}: {
  dateOfEvent: string
  endDateOfEvent?: string
  timeOfEvent: string
}) {
  const hasSchedule = Boolean(dateOfEvent && timeOfEvent)
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
        Derived event schedule
      </p>
      {hasSchedule ? (
        <p className="mt-1 text-sm text-neutral-900">
          <span className="font-semibold">
            {formatRangeLabel(dateOfEvent, endDateOfEvent)}
          </span>
          {timeOfEvent ? <span> · {timeOfEvent}</span> : null}
        </p>
      ) : (
        <p className="mt-1 text-sm text-neutral-500">
          Reserve at least one slot to set the event date and time.
        </p>
      )}
    </div>
  )
}

function formatDateLabel(dateKey: string): string {
  const date = parseDateKey(dateKey)
  return date ? formatDisplayDate(date, "long") : dateKey
}

function formatRangeLabel(start: string, end?: string): string {
  if (!end || end === start) return formatDateLabel(start)
  return `${formatDateLabel(start)} – ${formatDateLabel(end)}`
}
