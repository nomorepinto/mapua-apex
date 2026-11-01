import { useEffect, useRef, useState } from "react"
import { FileDown, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { apiClient } from "@/lib/api-client"
import { exportReportCsv } from "@/lib/report-export"
import {
  REPORTS,
  dateRangeError,
  facetOptions,
  presetRange,
  type FacetOptions,
  type ReportFilters,
  type ReportKind,
  type ReportPayload,
  type ReportRecord,
} from "@/lib/reporting"
import { useReportCollection } from "@/hooks/use-reporting"
import {
  ReportFilterControls,
  ReportMultiSelect,
  ReportSelect,
} from "./report-filters"
import { ReportPreview } from "./report-preview"
import {
  freezeReport,
  type TimelineReportRequest,
} from "@/lib/timeline-reporting"

interface ReportDialogProps {
  kind: ReportKind
  endpoint: string
  loadReport?: (
    request: TimelineReportRequest,
    signal: AbortSignal
  ) => Promise<ReportPayload>
  filters: ReportFilters
  options?: FacetOptions
  onApply?: (filters: ReportFilters) => void
  allowProposalTemplate?: boolean
}
export function ReportDialog(props: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <FileDown className="size-4" />
        Generate report
      </DialogTrigger>
      {open && <ReportDialogBody {...props} />}
    </Dialog>
  )
}
function ReportDialogBody({
  kind: initialKind,
  endpoint,
  loadReport,
  filters,
  options = {},
  onApply,
  allowProposalTemplate,
}: ReportDialogProps) {
  const [kind, setKind] = useState(initialKind)
  const [draft, setDraft] = useState<ReportFilters>(() => ({
    ...filters,
    ...(!filters.start_date || !filters.end_date
      ? presetRange("This month")
      : {}),
  }))
  const [sections, setSections] = useState(["summary", "breakdowns", "details"])
  const [columns, setColumns] = useState(REPORTS[kind].defaults)
  const [compare, setCompare] = useState(false)
  const [preview, setPreview] = useState<ReportPayload | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const revision = useRef(0)
  const target = kind === initialKind ? endpoint : "/admins/submissions"
  const templateRecords = useReportCollection<ReportRecord>(
    "proposals",
    "/admins/submissions",
    {},
    kind !== initialKind
  )
  const isMonitor = kind === "activity" || kind === "sessions"
  const periodOptions = useReportCollection<ReportRecord>(
    kind,
    target,
    { start_date: draft.start_date, end_date: draft.end_date },
    isMonitor && !dateRangeError(draft, true)
  )
  const availableOptions = isMonitor
    ? facetOptions(kind, periodOptions.data ?? [])
    : kind === initialKind
      ? options
      : facetOptions("proposals", templateRecords.data ?? [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])
  const invalidate = () => {
    revision.current++
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    setPreview(null)
    setAcknowledged(false)
    setError("")
  }
  const changeFilters = (next: ReportFilters) => {
    invalidate()
    setDraft(next)
  }
  const generate = async () => {
    if (controller.current) return
    const invalid = dateRangeError(draft, true)
    if (invalid) {
      setError(invalid)
      return
    }
    const requestController = new AbortController()
    controller.current = requestController
    setBusy(true)
    setPreview(null)
    setAcknowledged(false)
    setError("")
    try {
      const request = {
        filters: draft,
        sections,
        columns,
        compare_previous_period: compare,
      }
      if (
        (kind === "session_timeline" || kind === "proposal_timeline") &&
        !loadReport
      )
        throw new Error("A record-scoped timeline source is required.")
      const result = loadReport
        ? await loadReport(request, requestController.signal)
        : (
            await apiClient.post<{ data: ReportPayload }>(
              `${target}/report`,
              request,
              { signal: requestController.signal, cache: "no-store" }
            )
          ).data
      requestController.signal.throwIfAborted()
      if (!result?.coverage?.retrieval_complete)
        throw new Error("Retrieval is incomplete. No file can be generated.")
      if (mounted.current) setPreview(freezeReport(result))
    } catch (failure) {
      if (mounted.current && !requestController.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Report generation failed."
        )
    } finally {
      if (controller.current === requestController) {
        controller.current = null
        if (mounted.current) setBusy(false)
      }
    }
  }
  const download = async (format: "pdf" | "summary" | "details") => {
    if (!preview || downloading) return
    const downloadRevision = revision.current
    setDownloading(true)
    setError("")
    try {
      if (format === "pdf") {
        const pdf = await import("@/lib/report-pdf")
        if (mounted.current && downloadRevision === revision.current)
          pdf.exportReportPdf(preview, acknowledged)
      } else exportReportCsv(preview, format, acknowledged)
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error ? failure.message : "Download failed."
        )
    } finally {
      if (mounted.current) setDownloading(false)
    }
  }
  const downloadable =
    preview &&
    (preview.coverage.historical_coverage_complete || acknowledged) &&
    !busy &&
    !downloading
  return (
    <DialogPopup className="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>
          Generate {REPORTS[kind].title.toLowerCase()} report
        </DialogTitle>
        <DialogDescription>
          Choose a period, preview the complete result, then download PDF or
          CSV. Files are generated locally and are not retained on the server.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="space-y-4">
          {allowProposalTemplate && (
            <ReportSelect
              label="Report template"
              value={kind}
              options={{
                activity: "Recorded activities",
                proposals: "Proposal statistics",
              }}
              onChange={(value) => {
                invalidate()
                const next = value as ReportKind
                setKind(next)
                setColumns(REPORTS[next].defaults)
                setDraft({ ...presetRange("This month"), sort: "desc" })
              }}
            />
          )}
          {kind !== initialKind && (
            <p className="rounded-lg bg-neutral-50 p-3 text-sm">
              Proposal statistics uses distinct proposals. Switching templates
              resets incompatible filters.{" "}
              {templateRecords.isError
                ? "Could not retrieve filter options; refresh this dialog to retry."
                : ""}
            </p>
          )}
          {!filters.start_date && (
            <p className="text-sm text-neutral-600">
              Proposed report period: This month. The page remains unbounded
              until you explicitly apply these filters.
            </p>
          )}
          <ReportFilterControls
            kind={kind}
            filters={draft}
            onChange={changeFilters}
            options={availableOptions}
            requiredDates
          />
          {isMonitor && periodOptions.isFetching && (
            <p className="text-xs text-neutral-500">
              Loading recorded filter values for this period…
            </p>
          )}
          {isMonitor && periodOptions.isError && (
            <p role="alert" className="text-xs text-red-700">
              Filter values could not be loaded.{" "}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => periodOptions.refetch()}
              >
                Retry filter values
              </Button>
            </p>
          )}
          <fieldset className="space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">
              Report contents
            </legend>
            <div className="flex flex-wrap gap-4">
              {[
                ["summary", "Summary"],
                ["breakdowns", "Breakdowns and charts"],
                ["details", "Detail rows"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={sections.includes(key)}
                    onCheckedChange={(checked) => {
                      invalidate()
                      setSections(
                        checked
                          ? [...sections, key]
                          : sections.filter((item) => item !== key)
                      )
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={compare}
                onCheckedChange={(checked) => {
                  invalidate()
                  setCompare(checked)
                }}
              />
              Compare with the preceding equal-length period
            </label>
            <ReportMultiSelect
              label="Export columns and appendices"
              options={Object.entries(REPORTS[kind].columns).map(
                ([value, label]) => ({ value, label })
              )}
              selected={columns}
              onChange={(next) => {
                invalidate()
                setColumns(next)
              }}
            />
            <p className="text-xs text-neutral-500">
              Sensitive columns are opt-in. Summary-only reports still aggregate
              all matching records. Maximum period: 366 days; details: 10,000
              rows.
            </p>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={generate}
              disabled={
                busy ||
                downloading ||
                Boolean(dateRangeError(draft, true)) ||
                !sections.length ||
                !columns.length
              }
            >
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {busy
                ? "Retrieving complete report…"
                : preview
                  ? "Refresh preview"
                  : "Preview report"}
            </Button>
            {busy && (
              <Button variant="outline" onClick={invalidate}>
                Cancel retrieval
              </Button>
            )}
            {onApply && kind === initialKind && (
              <Button
                variant="outline"
                disabled={Boolean(dateRangeError(draft, true))}
                onClick={() => onApply(draft)}
              >
                Apply these filters to page
              </Button>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {preview ? (
            <ReportPreview report={preview} />
          ) : (
            !busy && (
              <p className="text-sm text-neutral-500">
                Preview required. Filter and content changes invalidate the
                previous preview.
              </p>
            )
          )}
          {preview && !preview.coverage.historical_coverage_complete && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={setAcknowledged}
              />
              I acknowledge the coverage limits and understand that this report
              does not represent complete historical records.
            </label>
          )}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button
          variant="outline"
          disabled={
            !downloadable ||
            (!sections.includes("summary") && !sections.includes("breakdowns"))
          }
          onClick={() => download("summary")}
        >
          Summary CSV
        </Button>
        <Button
          variant="outline"
          disabled={!downloadable || !sections.includes("details")}
          onClick={() => download("details")}
        >
          Detail CSV
        </Button>
        <Button disabled={!downloadable} onClick={() => download("pdf")}>
          {downloading ? "Preparing download…" : "Download PDF"}
        </Button>
      </DialogFooter>
    </DialogPopup>
  )
}
