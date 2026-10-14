import { CalendarClock } from "lucide-react"

import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/admin/reservables/segmented-control"
import { useReservationsPage } from "@/components/cdm/reservations/reservations-context"
import { Badge } from "@/components/ui/badge"
import { Card, CardPanel } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { layout } from "@/config"
import type { ReservationChangeFilter } from "@/hooks/use-reservation-changes"
import { formatDisplayDate } from "@/lib/dynamodb-adapters"
import type { ApiReservationChange, ReservationChangeStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const FILTER_ITEMS: SegmentedItem<ReservationChangeFilter>[] = [
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
]

const STATUS_META: Record<
  ReservationChangeStatus,
  { label: string; variant: "warning" | "success" | "secondary" }
> = {
  pending: { label: "Pending", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  denied: { label: "Denied", variant: "secondary" },
}

/**
 * Left column of the master–detail desk: the per-campus request queue with a
 * Pending / All filter. Selecting a row drives the detail panel on the right.
 */
export function RequestList() {
  const { state, actions } = useReservationsPage()
  const { changes, changesLoading, changesError, status, selectedChangeId } =
    state

  return (
    <Card className={cn(layout.card, "min-w-0")}>
      <CardPanel className="flex flex-col gap-3">
        <SegmentedControl
          ariaLabel="Filter reservation requests"
          items={FILTER_ITEMS}
          onChange={actions.setStatus}
          value={status}
        />

        {changesError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {changesError}
          </p>
        ) : changesLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : changes.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No requests</EmptyTitle>
              <EmptyDescription>
                {status === "pending"
                  ? "No pending reservation change requests for this campus."
                  : "No reservation change requests for this campus yet."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {changes.map((change, index) => (
              <RequestRow
                change={change}
                key={change.change_id ?? `${change.event_id ?? "evt"}-${index}`}
                onSelect={() => actions.selectChange(change.change_id)}
                selected={
                  Boolean(change.change_id) &&
                  change.change_id === selectedChangeId
                }
              />
            ))}
          </ul>
        )}
      </CardPanel>
    </Card>
  )
}

function RequestRow({
  change,
  selected,
  onSelect,
}: {
  change: ApiReservationChange
  selected: boolean
  onSelect: () => void
}) {
  const isCancel = change.request_type === "cancel"
  const title =
    change.event_title || change.submission_id || "Reservation request"
  const requested = change.requested_at
    ? formatDisplayDate(change.requested_at)
    : null
  const statusMeta = change.status ? STATUS_META[change.status] : null

  return (
    <li>
      <button
        aria-current={selected || undefined}
        className={cn(
          "w-full rounded-xl border p-3 text-left transition-colors",
          selected
            ? "border-[#8B0000] bg-[#8B0000]/5"
            : "border-neutral-200 bg-white hover:bg-neutral-50"
        )}
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {title}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {change.organization_name ?? "Organization"}
            </p>
          </div>
          <Badge size="sm" variant={isCancel ? "destructive" : "info"}>
            {isCancel ? "Cancel" : "Reschedule"}
          </Badge>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-neutral-400">
            {requested ? `Requested ${requested}` : "Requested"}
          </span>
          {statusMeta ? (
            <Badge size="sm" variant={statusMeta.variant}>
              {statusMeta.label}
            </Badge>
          ) : null}
        </div>
      </button>
    </li>
  )
}
