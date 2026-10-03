import { Plus } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { DAY_PICKER_STYLES } from "@/components/org-dashboard/day-picker-styles"
import { getDateKey } from "@/lib/date-key"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function CalendarCard({
  selectedDate,
  calendarEvents,
  onSelectDate,
  onNewEvent,
}: {
  selectedDate: Date | undefined
  calendarEvents: Record<string, { title: string; time?: string }[]>
  onSelectDate: (date: Date | undefined) => void
  onNewEvent: () => void
}) {
  const selectedKey = selectedDate ? getDateKey(selectedDate) : null
  const selectedEvents = selectedKey ? calendarEvents[selectedKey] : undefined

  return (
    <div className={cn(layout.section, "relative flex min-w-0 flex-col justify-between xl:col-span-1")}>
      <button
        onClick={onNewEvent}
        className="absolute top-4 right-4 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full border border-neutral-100 bg-neutral-50 text-[#1E293B] transition-colors hover:bg-neutral-100 sm:top-6 sm:right-6 sm:size-7"
        title="New Event"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={onSelectDate}
        classNames={DAY_PICKER_STYLES}
        formatters={{
          formatWeekdayName: (day) =>
            day.toLocaleDateString("en-US", { weekday: "narrow" }),
        }}
        modifiers={{
          hasEvent: (date) => !!calendarEvents[getDateKey(date)]?.length,
        }}
        modifiersClassNames={{
          hasEvent:
            "relative after:content-[''] after:absolute after:bottom-[3px] after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-[#4ADE80] after:rounded-full",
        }}
        showOutsideDays
      />

      <div className="mt-5 flex flex-col gap-2 border-t border-neutral-100 pt-3">
        {selectedDate ? (
          selectedEvents && selectedEvents.length > 0 ? (
            <>
              <h3 className="text-xs font-bold tracking-wider text-neutral-600 uppercase">
                Events on{" "}
                {selectedDate.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </h3>
              <div className="flex flex-col gap-2">
                {selectedEvents.map((evt, i) => (
                  <div key={`${evt.title}-${i}`} className="flex items-start gap-2.5">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ADE80]" />
                    <div>
                      <p className="text-xs leading-snug font-bold text-[#1E293B]">
                        {evt.title}
                      </p>
                      {evt.time ? (
                        <p className="mt-0.5 text-xs text-[#64748B]">{evt.time}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-600">No events on this date.</p>
          )
        ) : (
          <p className="text-xs text-neutral-600">Select a date to see events.</p>
        )}
      </div>
    </div>
  )
}
