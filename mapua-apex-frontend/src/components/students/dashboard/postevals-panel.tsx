import { useMemo, useState } from "react"
import { Link } from "react-router"

import { PostEvalDetailDialog } from "@/components/students/dashboard/posteval-detail-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { LoadingBlock } from "@/components/ui/loading-block"
import { useOrgPostEvalsQuery } from "@/hooks/use-postevals"
import {
  apiPostEvalToDashboardRow,
  formatDocumentId,
  getPostEvalStatusMeta,
} from "@/lib/dynamodb-adapters"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "submitted" | "approved" | "denied"

const STATUS_CHIPS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
]

function StatusBadge({ status }: { status: string }) {
  const meta = getPostEvalStatusMeta(status)
  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-bold",
        meta.color
      )}
    >
      {meta.label}
    </span>
  )
}

/**
 * Student dashboard panel listing every post-evaluation the org has filed.
 * Mirrors `SubmissionsPanel` (search, status filter, sortable date, row → detail
 * dialog) but is self-contained: it reads straight from `useOrgPostEvalsQuery`
 * rather than the dashboard context.
 */
export function PostEvalsPanel() {
  const { data, isPending, isError } = useOrgPostEvalsQuery()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortDesc, setSortDesc] = useState(true)
  const [selected, setSelected] = useState<{
    eventId: string
    postevalId: string
  } | null>(null)

  const rows = useMemo(
    () => (data ?? []).map(apiPostEvalToDashboardRow),
    [data]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows
      .filter((row) => statusFilter === "all" || row.api_status === statusFilter)
      .filter(
        (row) =>
          !query ||
          row.id.toLowerCase().includes(query) ||
          row.event_title.toLowerCase().includes(query) ||
          row.status.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const left = new Date(a.submitted_at || 0).getTime()
        const right = new Date(b.submitted_at || 0).getTime()
        return sortDesc ? right - left : left - right
      })
  }, [rows, search, statusFilter, sortDesc])

  return (
    <div className={cn(layout.section, "overflow-hidden")}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] sm:text-xl">
            Post-Evaluations
          </h2>
          <p className="text-xs text-neutral-600">
            Reports filed after each event · OSAAR approval marks it finished
          </p>
        </div>
        <Input
          aria-label="Search post-evaluations"
          className="w-full min-w-0 sm:w-64"
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="Search all columns"
          type="search"
          value={search}
        />
      </div>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setStatusFilter(chip.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              statusFilter === chip.value
                ? "border-[#8B0000] bg-[#8B0000] text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className={layout.tableWrap}>
        <Table className={cn(layout.table, "min-w-0 text-left sm:min-w-[36rem]")}>
          <TableHeader>
            <TableRow className="border-b border-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-600">
              <TableHead className="pb-3 pr-4 font-bold">Document ID</TableHead>
              <TableHead className="pb-3 pr-4 font-bold">Event Title</TableHead>
              <TableHead className="hidden pb-3 pr-4 font-bold sm:table-cell">
                Attendees
              </TableHead>
              <TableHead className="hidden pb-3 pr-4 font-bold sm:table-cell">
                Evaluations
              </TableHead>
              <TableHead className="hidden pb-3 pr-4 font-bold sm:table-cell">
                <button
                  type="button"
                  onClick={() => setSortDesc((prev) => !prev)}
                  className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-neutral-600 hover:text-[#8B0000]"
                >
                  Date Filed
                  <span aria-hidden>{sortDesc ? "↓" : "↑"}</span>
                </button>
              </TableHead>
              <TableHead className="pb-3 text-right font-bold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-neutral-50">
            {isPending ? (
              <TableRow>
                <TableCell colSpan={6} className="py-4">
                  <LoadingBlock label="Loading post-evaluations" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm font-semibold text-rose-600"
                >
                  Could not load post-evaluations.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-bold text-[#1E293B]">
                      No post-evaluations yet
                    </p>
                    <p className="mb-2 text-xs text-neutral-600">
                      File a post-evaluation within 3 days of a passed event.
                    </p>
                    <Link
                      to="/students/postevals"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B0000] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#6B0000]"
                    >
                      <span>+ File Post-Evaluation</span>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm font-semibold text-neutral-600"
                >
                  {search.trim()
                    ? `No post-evaluations match “${search.trim()}”.`
                    : "No post-evaluations match the selected status."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={`${row.event_id}:${row.posteval_id}`}
                  className="group cursor-pointer transition-colors hover:bg-neutral-50/80"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelected({
                      eventId: row.event_id,
                      postevalId: row.posteval_id,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelected({
                        eventId: row.event_id,
                        postevalId: row.posteval_id,
                      })
                    }
                  }}
                >
                  <TableCell
                    className="py-3.5 pr-4 font-mono text-xs font-bold whitespace-nowrap text-[#1E293B] group-hover:text-[#D9291C]"
                    title={row.posteval_id}
                  >
                    {formatDocumentId(row.posteval_id, "POST")}
                  </TableCell>
                  <TableCell className="py-3.5 pr-4 text-xs font-semibold break-words text-[#1E293B]">
                    {row.event_title}
                    {/* Mobile: status rides under the title since the column hides. */}
                    <span className="mt-1 block w-fit sm:hidden">
                      <StatusBadge status={row.api_status} />
                    </span>
                  </TableCell>
                  <TableCell className="hidden py-3.5 pr-4 text-xs text-[#64748B] sm:table-cell">
                    {row.attendance_count}
                  </TableCell>
                  <TableCell className="hidden py-3.5 pr-4 text-xs text-[#64748B] sm:table-cell">
                    {row.evaluation_count}
                  </TableCell>
                  <TableCell className="hidden py-3.5 pr-4 text-xs whitespace-nowrap text-[#64748B] sm:table-cell">
                    {row.submitted_date}
                  </TableCell>
                  <TableCell className="hidden py-3.5 text-right whitespace-nowrap sm:table-cell">
                    <StatusBadge status={row.api_status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PostEvalDetailDialog
        open={Boolean(selected)}
        eventId={selected?.eventId}
        postevalId={selected?.postevalId}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
