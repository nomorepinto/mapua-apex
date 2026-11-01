import { Button } from "@/components/ui/button"
import { LoadingBlock } from "@/components/ui/loading-block"
import { useReportSummary } from "@/hooks/use-reporting"
import {
  dateRangeError,
  type ReportKind,
  type ReportFilters,
  type FacetOptions,
} from "@/lib/reporting"
import { ReportFilterControls } from "./report-filters"
import { ReportDialog } from "./report-dialog"
import { ReportPreview } from "./report-preview"

interface ReportToolbarProps {
  kind: ReportKind
  endpoint: string
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
  onReset: () => void
  options: FacetOptions
  count?: number
  ready?: boolean
  showSummary?: boolean
}

export function ReportToolbar({
  kind,
  endpoint,
  filters,
  onChange,
  onReset,
  options,
  count,
  ready = true,
  showSummary = false,
}: ReportToolbarProps) {
  const summary = useReportSummary(
    kind,
    endpoint,
    filters,
    showSummary && ready
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500">
          Dates use Manila time. Choices within a field are combined with OR;
          different fields with AND.
        </p>
        <ReportDialog
          kind={kind}
          endpoint={endpoint}
          filters={filters}
          options={options}
          onApply={onChange}
          allowProposalTemplate={kind === "activity"}
        />
      </div>
      <ReportFilterControls
        kind={kind}
        filters={filters}
        onChange={onChange}
        onReset={onReset}
        options={options}
        count={ready ? count : undefined}
        allowAllDates={kind !== "sessions" && kind !== "activity"}
      />
      {showSummary &&
        ready &&
        !dateRangeError(filters, true) &&
        (summary.isPending ? (
          <LoadingBlock label="Calculating filtered statistics" />
        ) : summary.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 p-3 text-sm text-red-800"
          >
            Statistics unavailable. No partial total is shown.{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => summary.refetch()}
            >
              Retry statistics
            </Button>
          </div>
        ) : (
          summary.data && <ReportPreview report={summary.data} compact />
        ))}
    </div>
  )
}
