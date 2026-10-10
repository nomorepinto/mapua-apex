import { useMemo, useState } from "react"
import { CalendarDaysIcon } from "lucide-react"

import {
  CampusSelect,
  ReservableSelect,
} from "@/components/admin/reservables/reservables-fields"
import { useReservablesPage } from "@/components/admin/reservables/reservables-context"
import {
  AvailabilityLegend,
  DaySlotGrid,
  dayAvailabilityState,
} from "@/components/admin/reservables/schedule-grid"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { layout } from "@/config"
import { useAdminAvailabilityQuery } from "@/hooks/use-availability"
import {
  addDays,
  formatDisplayDate,
  getDateKey,
  startOfLocalDay,
} from "@/lib/date-key"
import { dayKeyForDate } from "@/lib/schedule-slots"
import { cn } from "@/lib/utils"

const DAY_DOT =
  "relative after:content-[''] after:absolute after:bottom-[4px] after:left-1/2 after:-translate-x-1/2 after:size-1.5 after:rounded-full"

export function ViewReservableSection() {
  const { state, actions } = useReservablesPage()
  const { campuses, campusId, reservables, selectedReservableId, selectedReservable } =
    state

  const [month, setMonth] = useState<Date>(
    () => new Date(startOfLocalDay().getFullYear(), startOfLocalDay().getMonth(), 1)
  )
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfLocalDay())

  // Fetch availability for the visible month plus a week of padding on each side
  // so outside-days cells still render a state.
  const window = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return {
      start: getDateKey(addDays(monthStart, -7)),
      end: getDateKey(addDays(monthEnd, 7)),
    }
  }, [month])

  const availabilityQuery = useAdminAvailabilityQuery(
    campusId,
    selectedReservableId,
    window
  )
  const availability = availabilityQuery.data ?? null

  const selectedDateKey = selectedDate ? getDateKey(selectedDate) : null
  const selectedIsSunday = selectedDateKey ? dayKeyForDate(selectedDateKey) === null : false

  const modifiers = useMemo(
    () => ({
      availOpen: (date: Date) =>
        dayAvailabilityState(availability, getDateKey(date)) === "open",
      availPartial: (date: Date) =>
        dayAvailabilityState(availability, getDateKey(date)) === "partial",
      availFull: (date: Date) =>
        dayAvailabilityState(availability, getDateKey(date)) === "full",
      availClosed: (date: Date) =>
        dayAvailabilityState(availability, getDateKey(date)) === "closed",
    }),
    [availability]
  )

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]",
        layout.gap
      )}
    >
      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Inspect a reservable</CardTitle>
          <CardDescription>
            Choose a campus and a room or equipment to see its live calendar.
            This view changes nothing.
          </CardDescription>
        </CardHeader>
        <CardPanel className="flex flex-col gap-4">
          <CampusSelect
            campuses={campuses}
            id="view-campus"
            onChange={actions.setCampusId}
            value={campusId}
          />
          <ReservableSelect
            id="view-reservable"
            onChange={actions.setSelectedReservableId}
            reservables={reservables}
            value={selectedReservableId}
          />
          {selectedReservable ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-sm font-semibold text-neutral-900">
                {selectedReservable.name}
              </p>
              <p className="text-xs text-neutral-500 capitalize">
                {selectedReservable.type}
              </p>
            </div>
          ) : null}
        </CardPanel>
      </Card>

      <Card className={cn(layout.card, "min-w-0")}>
        {!selectedReservable ? (
          <CardPanel>
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDaysIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No reservable selected</EmptyTitle>
                <EmptyDescription>
                  Pick a campus and a reservable to view its availability
                  calendar.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardPanel>
        ) : (
          <>
            <CardHeader>
              <CardTitle>{selectedReservable.name}</CardTitle>
              <CardDescription>
                Effective availability = weekly template minus existing bookings.
              </CardDescription>
            </CardHeader>
            <CardPanel className="flex flex-col gap-4">
              <AvailabilityLegend />
              {availabilityQuery.isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
                  <Calendar
                    modifiers={modifiers}
                    modifiersClassNames={{
                      availOpen: cn(DAY_DOT, "after:bg-emerald-500"),
                      availPartial: cn(DAY_DOT, "after:bg-amber-500"),
                      availFull: cn(DAY_DOT, "after:bg-rose-500"),
                      availClosed: "text-neutral-300 line-through",
                    }}
                    month={month}
                    onMonthChange={setMonth}
                    onSelect={(date: Date | undefined) => {
                      if (date) setSelectedDate(date)
                    }}
                    selected={selectedDate}
                  />
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        {selectedDate ? formatDisplayDate(selectedDate, "long") : ""}
                      </h3>
                      <span className="text-xs text-neutral-500 capitalize">
                        {selectedIsSunday
                          ? "Sunday — not reservable"
                          : dayLabelForState(
                              selectedDateKey
                                ? dayAvailabilityState(availability, selectedDateKey)
                                : "unknown"
                            )}
                      </span>
                    </div>
                    {selectedDateKey ? (
                      <DaySlotGrid
                        availability={availability}
                        date={selectedDateKey}
                        mode="view"
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </CardPanel>
          </>
        )}
      </Card>
    </div>
  )
}

function dayLabelForState(state: string): string {
  switch (state) {
    case "open":
      return "Available"
    case "partial":
      return "Partly booked"
    case "full":
      return "Fully booked"
    case "closed":
      return "Not reservable"
    default:
      return "Outside the loaded range"
  }
}
