import { useMemo, useState } from "react"

import { ActivityFilterHeader } from "@/components/signatories/dashboard/activity-filter-header"
import { ActivitySortHeader } from "@/components/signatories/dashboard/activity-sort-header"
import { ActivityTableSearch } from "@/components/signatories/dashboard/activity-table-search"
import {
  usePostEvalsReview,
  type PostEvalSelection,
} from "@/components/osaar/postevals/postevals-review-context"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ActivityFilterColumn,
  ActivitySortDirection,
} from "@/hooks/use-activity-table-filters"
import {
  apiPostEvalToDashboardRow,
  formatDocumentId,
  getPostEvalStatusMeta,
  type DashboardPostEvalRow,
} from "@/lib/dynamodb-adapters"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

type ColumnFilters = Partial<Record<ActivityFilterColumn, string[]>>

function StatusBadge({ status }: { status: string }) {
  const meta = getPostEvalStatusMeta(status)
  return (
    <span
      className={cn("rounded-md border px-2.5 py-1 text-xs font-bold", meta.color)}
    >
      {meta.label}
    </span>
  )
}

/**
 * OSAAR cross-organization post-evaluation queue. Reuses the signatory
 * dashboard's presentational header controls (multi-select filter, sort,
 * search) but drives them from local state, since post-evals are not
 * submission-shaped `Activity` rows. Row click opens the review dialog.
 */
export function PostEvalQueue() {
  const { postEvals, isLoading, isError, selectPostEval } = usePostEvalsReview()

  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [sortDirection, setSortDirection] = useState<ActivitySortDirection>("desc")

  const rows = useMemo<DashboardPostEvalRow[]>(
    () => postEvals.map(apiPostEvalToDashboardRow),
    [postEvals]
  )

  const organizationOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.organization_name)))
        .filter((value) => value && value !== "—")
        .sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const toggleColumnFilter = (column: ActivityFilterColumn, value: string) => {
    setColumnFilters((prev) => {
      const current = prev[column] ?? []
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
      return { ...prev, [column]: next }
    })
  }

  const clearColumnFilter = (column: ActivityFilterColumn) => {
    setColumnFilters((prev) => ({ ...prev, [column]: [] }))
  }

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const orgFilter = columnFilters.organization ?? []
    const statusFilter = columnFilters.status ?? []

    return rows
      .filter((row) => {
        if (query) {
          const haystack = [row.id, row.organization_name, row.event_title, row.status]
            .join(" ")
            .toLowerCase()
          if (!haystack.includes(query)) return false
        }
        if (orgFilter.length && !orgFilter.includes(row.organization_name)) return false
        if (statusFilter.length && !statusFilter.includes(row.status)) return false
        return true
      })
      .sort((a, b) => {
        const diff = (Date.parse(a.submitted_at) || 0) - (Date.parse(b.submitted_at) || 0)
        return sortDirection === "asc" ? diff : -diff
      })
  }, [rows, search, columnFilters, sortDirection])

  const openRow = (row: DashboardPostEvalRow): PostEvalSelection => ({
    eventId: row.event_id,
    postevalId: row.posteval_id,
  })

  return (
    <section className={layout.section}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex shrink-0 flex-col gap-1">
          <h2 className="text-lg font-extrabold text-neutral-900">Post-Evaluations</h2>
          <p className="text-xs text-neutral-500">
            Filed by organizations after each event. Approving marks the linked
            submission finished.
          </p>
        </div>
        <ActivityTableSearch
          ariaLabel="Search post-evaluations"
          onChange={setSearch}
          value={search}
        />
      </div>

      <div className={layout.sectionFlush}>
        <div className={layout.tableWrap}>
          <Table className={layout.table}>
            <TableHeader>
              <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-500 uppercase hover:bg-transparent!">
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  DOCUMENT ID
                </TableHead>
                <ActivityFilterHeader
                  column="organization"
                  label="Organization"
                  onClear={clearColumnFilter}
                  onToggle={toggleColumnFilter}
                  options={organizationOptions}
                  selected={columnFilters.organization ?? []}
                />
                <TableHead className="px-6 py-4 font-bold text-neutral-500">
                  EVENT TITLE
                </TableHead>
                <TableHead className="hidden px-6 py-4 font-bold text-neutral-500 lg:table-cell">
                  ATTENDEES
                </TableHead>
                <TableHead className="hidden px-6 py-4 font-bold text-neutral-500 lg:table-cell">
                  EVALUATIONS
                </TableHead>
                <ActivitySortHeader
                  direction={sortDirection}
                  label="Submitted"
                  onSort={toggleSort}
                />
                <ActivityFilterHeader
                  align="right"
                  className="text-right"
                  column="status"
                  label="Status"
                  onClear={clearColumnFilter}
                  onToggle={toggleColumnFilter}
                  options={statusOptions}
                  selected={columnFilters.status ?? []}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center text-sm text-neutral-400">
                    Loading post-evaluations…
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-14 text-center text-sm font-semibold text-rose-600"
                  >
                    Could not load post-evaluations.
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center text-sm text-neutral-400">
                    {rows.length === 0
                      ? "No post-evaluations have been filed yet."
                      : search.trim()
                        ? `No post-evaluations match "${search.trim()}".`
                        : "No post-evaluations match the selected filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow
                    key={`${row.event_id}:${row.posteval_id}`}
                    className="group cursor-pointer transition-colors hover:bg-neutral-50/80"
                    role="button"
                    tabIndex={0}
                    onClick={() => selectPostEval(openRow(row))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        selectPostEval(openRow(row))
                      }
                    }}
                  >
                    <TableCell
                      className="px-6 py-4 font-mono text-xs font-bold whitespace-nowrap text-neutral-900 group-hover:text-[#D9291C]"
                      title={row.posteval_id}
                    >
                      {formatDocumentId(row.posteval_id, "POST")}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-semibold text-neutral-700">
                      {row.organization_name}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-semibold break-words text-neutral-900">
                      {row.event_title}
                    </TableCell>
                    <TableCell className="hidden px-6 py-4 text-xs text-neutral-500 lg:table-cell">
                      {row.attendance_count}
                    </TableCell>
                    <TableCell className="hidden px-6 py-4 text-xs text-neutral-500 lg:table-cell">
                      {row.evaluation_count}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs whitespace-nowrap text-neutral-500">
                      {row.submitted_date}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right whitespace-nowrap">
                      <StatusBadge status={row.api_status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
