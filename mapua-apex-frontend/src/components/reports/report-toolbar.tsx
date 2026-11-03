import {
  type ReportKind,
  type ReportFilters,
  type FacetOptions,
} from "@/lib/reporting"
import { ReportFilterControls } from "./report-filters"

interface ReportToolbarProps {
  kind: ReportKind
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
  onReset: () => void
  options: FacetOptions
  count?: number
  ready?: boolean
}

/**
 * In-place filter bar for a log or history panel. Date-range selection and every
 * PDF/CSV export live on the gated Reports & Export page, so this only narrows the
 * records already loaded on the current surface. Bounded logs keep their internal
 * default date range; the date controls stay hidden here.
 */
export function ReportToolbar({
  kind,
  filters,
  onChange,
  onReset,
  options,
  count,
  ready = true,
}: ReportToolbarProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Choices within a field are combined with OR; different fields with AND.
      </p>
      <ReportFilterControls
        kind={kind}
        filters={filters}
        onChange={onChange}
        onReset={onReset}
        options={options}
        count={ready ? count : undefined}
        hideDates
      />
    </div>
  )
}
