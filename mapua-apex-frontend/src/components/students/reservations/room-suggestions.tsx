import { PlusIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { capacityRangeLabel, suggestRooms } from "@/lib/reservable-capacity"
import type { ApiReservable } from "@/lib/types"
import { cn } from "@/lib/utils"

/** How many rooms the panel offers before falling back to the dropdown. */
const SUGGESTION_LIMIT = 3

interface RoomSuggestionsProps {
  /** Expected participants. Null or blank means there is nothing to match on. */
  headcount: number | null
  /** Rooms the student could still add: unpicked, and free during the event time. */
  rooms: ApiReservable[]
  onAdd: (reservableId: string) => void
}

/**
 * Advisory room picks for the expected headcount, shown above the room dropdown.
 *
 * The suggestion never changes what the dropdown offers or what the student has
 * already picked — Add is a shortcut for the same handler the dropdown uses, and
 * the capacity warnings below still carry the real verdict.
 */
export function RoomSuggestions({
  headcount,
  onAdd,
  rooms,
}: RoomSuggestionsProps) {
  const suggestions = suggestRooms(rooms, headcount, SUGGESTION_LIMIT)
  if (suggestions.length === 0) return null

  const anyFits = suggestions.some((suggestion) => suggestion.fits)

  return (
    <div
      aria-label={`Suggested rooms for ${headcount} participants`}
      className={cn(
        "rounded-lg border p-2.5",
        anyFits
          ? "border-sky-200 bg-sky-50/70"
          : "border-amber-200 bg-amber-50/70"
      )}
    >
      <div className="flex items-center gap-1.5">
        <SparklesIcon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0",
            anyFits ? "text-sky-600" : "text-amber-600"
          )}
        />
        <span className="text-[11px] font-semibold tracking-wide text-neutral-700 uppercase">
          Suggested for {headcount} participants
        </span>
      </div>

      {!anyFits ? (
        <p className="mt-1 text-[11px] text-amber-800">
          No single room holds {headcount} participants. These are the closest —
          add more than one, or lower the expected count.
        </p>
      ) : null}

      <ul className="mt-2 space-y-1.5">
        {suggestions.map(({ fits, reservable, shortfall }) => {
          const cap = capacityRangeLabel({
            min: reservable.min_participants,
            max: reservable.max_participants,
          })
          return (
            <li
              className="flex items-center justify-between gap-2 rounded-md border border-neutral-200/80 bg-white px-2.5 py-1.5"
              key={reservable.reservable_id}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-neutral-900">
                  {reservable.name}
                </span>
                <span className="block text-[11px] text-neutral-500">
                  {cap ? `${cap} pax` : "Capacity not stated"}
                  {fits ? null : ` · ${shortfall} pax short`}
                </span>
              </span>
              <Button
                aria-label={`Add ${reservable.name}`}
                className="h-7 shrink-0 cursor-pointer text-xs"
                onClick={() => onAdd(reservable.reservable_id)}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
