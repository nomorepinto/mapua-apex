/* eslint-disable react-refresh/only-export-components */
import { CheckIcon } from "lucide-react"

import {
  DAYS,
  DAY_LABELS,
  SLOT_COUNT,
  isValidSlot,
  slotLabel,
} from "@/lib/schedule-slots"
import type {
  ApiAvailability,
  ReservableDay,
  ReservableSchedule,
} from "@/lib/types"
import { cn } from "@/lib/utils"

/** Per-slot status for one concrete date, derived from computed availability. */
export type SlotStatus = "free" | "booked" | "unavailable"

/** Whole-day bucket used by the View calendar legend. */
export type DayAvailabilityState =
  | "open"
  | "partial"
  | "full"
  | "closed"
  | "unknown"

export function slotStatus(
  availability: ApiAvailability | undefined | null,
  date: string,
  slot: number
): SlotStatus {
  if (!isValidSlot(slot)) return "unavailable"
  const entry = availability?.dates?.[date]
  if (!entry) return "unavailable"
  if (entry.booked_slots?.includes(slot)) return "booked"
  if (entry.available_slots?.includes(slot)) return "free"
  return "unavailable"
}

export function dayAvailabilityState(
  availability: ApiAvailability | undefined | null,
  date: string
): DayAvailabilityState {
  const entry = availability?.dates?.[date]
  if (!entry) return "unknown"
  const free = entry.available_slots?.length ?? 0
  const booked = entry.booked_slots?.length ?? 0
  if (free === 0 && booked === 0) return "closed"
  if (free === 0) return "full"
  if (booked > 0) return "partial"
  return "open"
}

/* -------------------------------------------------------------------------- */
/* Weekly template grid — editable (Add / Edit reservable)                     */
/* -------------------------------------------------------------------------- */

export function ScheduleGrid({
  schedule,
  onToggle,
  onToggleDay,
  disabled = false,
}: {
  schedule: ReservableSchedule
  onToggle: (day: ReservableDay, slot: number) => void
  /** Flip an entire day column; when omitted the day header is a plain label. */
  onToggleDay?: (day: ReservableDay) => void
  disabled?: boolean
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div
        className="grid min-w-[34rem] grid-cols-[4.5rem_repeat(6,minmax(0,1fr))] gap-1"
        role="group"
        aria-label="Weekly availability template"
      >
        <div aria-hidden="true" />
        {DAYS.map((day) =>
          onToggleDay ? (
            <button
              className="rounded-md px-1 py-1 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-50"
              disabled={disabled}
              key={day}
              onClick={() => onToggleDay(day)}
              title={`Toggle all ${DAY_LABELS[day]} slots`}
              type="button"
            >
              {DAY_LABELS[day]}
            </button>
          ) : (
            <div
              className="px-1 py-1 text-center text-xs font-semibold text-neutral-600"
              key={day}
            >
              {DAY_LABELS[day]}
            </div>
          )
        )}

        {Array.from({ length: SLOT_COUNT }, (_, slot) => (
          <GridRow
            disabled={disabled}
            key={slot}
            onToggle={onToggle}
            schedule={schedule}
            slot={slot}
          />
        ))}
      </div>
    </div>
  )
}

function GridRow({
  slot,
  schedule,
  onToggle,
  disabled,
}: {
  slot: number
  schedule: ReservableSchedule
  onToggle: (day: ReservableDay, slot: number) => void
  disabled: boolean
}) {
  return (
    <>
      <div className="flex items-center pe-2 text-[11px] font-medium text-neutral-500 tabular-nums">
        {slotLabel(slot)}
      </div>
      {DAYS.map((day) => {
        const available = Boolean(schedule[day]?.[slot])
        return (
          <button
            aria-checked={available}
            aria-label={`${DAY_LABELS[day]} ${slotLabel(slot)}: ${
              available ? "available" : "unavailable"
            }`}
            className={cn(
              "flex h-8 items-center justify-center rounded-md border text-white transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              available
                ? "border-emerald-600 bg-emerald-500 hover:bg-emerald-600"
                : "border-neutral-300 bg-white text-transparent hover:bg-neutral-50",
              disabled && "pointer-events-none opacity-60"
            )}
            disabled={disabled}
            key={day}
            onClick={() => onToggle(day, slot)}
            role="switch"
            title={`${DAY_LABELS[day]} ${slotLabel(slot)} — ${
              available ? "available" : "unavailable"
            }`}
            type="button"
          >
            {available ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
          </button>
        )
      })}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Single-date slot grid — read-only (View) or free-slot picker (Reserve)      */
/* -------------------------------------------------------------------------- */

export function DaySlotGrid({
  date,
  availability,
  mode,
  selectedSlots = [],
  onToggleSlot,
  disabled = false,
}: {
  date: string
  availability: ApiAvailability | undefined | null
  mode: "view" | "select"
  selectedSlots?: number[]
  onToggleSlot?: (slot: number) => void
  disabled?: boolean
}) {
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {Array.from({ length: SLOT_COUNT }, (_, slot) => {
        const status = slotStatus(availability, date, slot)
        const selected = selectedSlots.includes(slot)
        const interactive = mode === "select" && status === "free" && !disabled
        const reason =
          status === "booked"
            ? "Already booked"
            : status === "unavailable"
              ? "Not offered at this time"
              : selected
                ? "Selected — click to remove"
                : "Free — click to select"

        return (
          <li key={slot}>
            <button
              aria-checked={mode === "select" ? selected : undefined}
              aria-disabled={mode === "select" && !interactive ? true : undefined}
              aria-label={`${slotLabel(slot)}: ${reason}`}
              className={cn(
                "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                status === "free" &&
                  (selected
                    ? "border-emerald-600 bg-emerald-500 text-white"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"),
                status === "booked" &&
                  "border-rose-200 bg-rose-50 text-rose-700 line-through",
                status === "unavailable" &&
                  "border-neutral-200 bg-neutral-100 text-neutral-400 line-through",
                interactive
                  ? "cursor-pointer hover:border-emerald-400"
                  : "cursor-not-allowed opacity-90"
              )}
              disabled={mode === "select" ? !interactive : true}
              onClick={() => {
                if (interactive) onToggleSlot?.(slot)
              }}
              role={mode === "select" ? "checkbox" : undefined}
              title={`${slotLabel(slot)} — ${reason}`}
              type="button"
            >
              <span className="font-medium tabular-nums">{slotLabel(slot)}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {status === "free"
                  ? selected
                    ? "Selected"
                    : "Free"
                  : status === "booked"
                    ? "Booked"
                    : "Closed"}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* Legends                                                                     */
/* -------------------------------------------------------------------------- */

const DAY_LEGEND: Array<{ state: DayAvailabilityState; label: string; dot: string }> =
  [
    { state: "open", label: "Available", dot: "bg-emerald-500" },
    { state: "partial", label: "Partly booked", dot: "bg-amber-500" },
    { state: "full", label: "Fully booked", dot: "bg-rose-500" },
    { state: "closed", label: "Not reservable", dot: "bg-neutral-300" },
  ]

/** Legend for the View month calendar. */
export function AvailabilityLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
      {DAY_LEGEND.map((item) => (
        <li className="inline-flex items-center gap-1.5" key={item.state}>
          <span aria-hidden="true" className={cn("size-2.5 rounded-full", item.dot)} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** Legend for a single-date slot grid. */
export function SlotLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600">
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-500" />
        Free
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-rose-500" />
        Booked
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-neutral-300" />
        Not offered
      </li>
    </ul>
  )
}

/** Map a whole-day state to the calendar modifier class token. */
export const DAY_STATE_CLASS: Record<DayAvailabilityState, string> = {
  open: "text-emerald-800",
  partial: "text-amber-800",
  full: "text-rose-800",
  closed: "text-neutral-400",
  unknown: "text-neutral-400",
}
