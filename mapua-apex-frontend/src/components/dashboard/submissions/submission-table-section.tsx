import { ActivityFilterHeader } from "@/components/signatories/dashboard/activity-filter-header"
import { ActivityRow } from "@/components/ui/activity-row"
import { ActivitySortHeader } from "@/components/signatories/dashboard/activity-sort-header"
import { ActivityTableSearch } from "@/components/signatories/dashboard/activity-table-search"
import { LoadingBlock } from "@/components/ui/loading-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Activity } from "@/components/ui/activity.types"
import { layout } from "@/config"
import {
  useActivityTableFilters,
  type ActivityStatusField,
} from "@/hooks/use-activity-table-filters"

export interface SubmissionTableSectionProps {
  title: string
  description: string
  /** The records this table lists; each section owns its own filter state. */
  activities: Activity[]
  /** Which field backs the trailing column — see `useActivityTableFilters`. */
  statusField: ActivityStatusField
  /** Header label of the trailing column ("Decision", "Current outcome", ...). */
  statusLabel: string
  /** Accessible name of the search box; also an e2e locator — keep stable. */
  searchLabel: string
  searchPlaceholder?: string
  loading: boolean
  error?: string | null
  onSelect: (activity: Activity) => void
  /** Copy shown when there is nothing to list at all. */
  emptyLabel: string
  /** Copy when filters/search hide every record; gets the active search term. */
  noMatchLabel?: (term: string) => string
}

/**
 * The one submissions table every review surface renders — the OSAAR dashboard's
 * Review and Submissions tabs and the adviser, dean and CDM desks' queue and
 * history lists. Presentational: it takes the rows and the select handler, so
 * each desk decides which records it shows and which modal a row opens.
 *
 * Search matches all columns, the Organization / Department / Type / status
 * headers filter by distinct value (OR inside a column, AND across columns) and
 * Submitted sorts chronologically — all handled by `useActivityTableFilters`.
 * The trailing header label and the cell it renders both follow `statusField`,
 * so a queue can show the decision it still owes and a history list the outcome
 * it reached, in the same column.
 */
export function SubmissionTableSection({
  title,
  description,
  activities,
  statusField,
  statusLabel,
  searchLabel,
  searchPlaceholder = "Search all columns",
  loading,
  error = null,
  onSelect,
  emptyLabel,
  noMatchLabel,
}: SubmissionTableSectionProps) {
  const filters = useActivityTableFilters(activities, statusField)
  const term = filters.search.trim()
  const noMatchCopy =
    noMatchLabel?.(term) ??
    (term
      ? `No records match “${term}”.`
      : "No records match the selected filters.")

  return (
    <section className={layout.section} aria-label={title}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex shrink-0 flex-col gap-1">
          <h2 className="text-lg font-extrabold text-neutral-900">{title}</h2>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <ActivityTableSearch
          ariaLabel={searchLabel}
          onChange={filters.setSearch}
          placeholder={searchPlaceholder}
          value={filters.search}
        />
      </div>

      <div className={layout.sectionFlush}>
        <Table
          className={layout.table}
          containerClassName="max-h-[36rem] overflow-auto"
        >
          <TableHeader className="sticky top-0 z-10 bg-white shadow-xs [&_th]:bg-white">
            <TableRow className="border-b border-neutral-200 text-xs font-bold tracking-wider text-neutral-500 uppercase hover:bg-transparent!">
              <TableHead className="px-6 py-4 font-bold text-neutral-500">
                DOCUMENT ID
              </TableHead>
              <ActivityFilterHeader
                column="organization"
                label="Organization"
                onClear={filters.clearColumnFilter}
                onToggle={filters.toggleColumnFilter}
                options={filters.filterOptions.organization}
                selected={filters.columnFilters.organization}
              />
              <ActivityFilterHeader
                column="department"
                label="Department"
                onClear={filters.clearColumnFilter}
                onToggle={filters.toggleColumnFilter}
                options={filters.filterOptions.department}
                selected={filters.columnFilters.department}
              />
              <TableHead className="px-6 py-4 font-bold text-neutral-500">
                ACTIVITY NAME
              </TableHead>
              <ActivitySortHeader
                direction={filters.sortDirection}
                label="Submitted"
                onSort={filters.toggleSort}
              />
              <ActivityFilterHeader
                capitalize
                column="type"
                label="Type"
                onClear={filters.clearColumnFilter}
                onToggle={filters.toggleColumnFilter}
                options={filters.filterOptions.type}
                selected={filters.columnFilters.type}
              />
              <ActivityFilterHeader
                align="right"
                className="text-right"
                column="status"
                label={statusLabel}
                onClear={filters.clearColumnFilter}
                onToggle={filters.toggleColumnFilter}
                options={filters.filterOptions.status}
                selected={filters.columnFilters.status}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4">
                  <LoadingBlock label={`Loading ${title.toLowerCase()}`} />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm text-rose-600"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : filters.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-14 text-center text-sm text-neutral-400"
                >
                  {activities.length === 0 ? emptyLabel : noMatchCopy}
                </TableCell>
              </TableRow>
            ) : (
              filters.rows.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  onSelect={onSelect}
                  statusField={statusField}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
