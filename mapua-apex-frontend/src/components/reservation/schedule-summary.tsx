import type { ReactNode } from "react"

import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import type { EventSchedule } from "@/lib/event-schedule"

function ScheduleField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs font-semibold text-neutral-700">
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * Read-only summary of the event schedule (locked to the SAAF activity details)
 * shown once at the top of the reservation step. Every reservation table shares
 * these values, so the per-row date/time columns were removed.
 */
export function ScheduleSummary({ schedule }: { schedule: EventSchedule }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-neutral-900">Event Schedule</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScheduleField label="Start Date">
          <DatePicker
            size="sm"
            disabled
            value={schedule.startDate}
            onChange={() => {}}
            placeholder="—"
            aria-label="Event start date"
          />
        </ScheduleField>
        <ScheduleField label="End Date">
          <DatePicker
            size="sm"
            disabled
            value={schedule.endDate}
            onChange={() => {}}
            placeholder="—"
            aria-label="Event end date"
          />
        </ScheduleField>
        <ScheduleField label="Start Time">
          <TimePicker
            size="sm"
            disabled
            value={schedule.startTime}
            onChange={() => {}}
            placeholder="—"
            aria-label="Event start time"
          />
        </ScheduleField>
        <ScheduleField label="End Time">
          <TimePicker
            size="sm"
            disabled
            value={schedule.endTime}
            onChange={() => {}}
            placeholder="—"
            aria-label="Event end time"
          />
        </ScheduleField>
      </div>
    </div>
  )
}
