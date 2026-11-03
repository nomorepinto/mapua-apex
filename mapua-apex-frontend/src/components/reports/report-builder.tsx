import { useEffect, useRef, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { apiClient } from "@/lib/api-client"
import { exportReportCsv } from "@/lib/report-export"
import {
  REPORTS,
  dateRangeError,
  facetOptions,
  presetRange,
  type CollectionReportKind,
  type ReportFilters,
  type ReportPayload,
  type ReportRecord,
} from "@/lib/reporting"
import { useReportCollection } from "@/hooks/use-reporting"
import { ReportFilterControls, ReportMultiSelect } from "./report-filters"
import { ReportPreview } from "./report-preview"
import { freezeReport } from "@/lib/timeline-reporting"

/**
 * Inline date-range report builder for the gated Reports & Export page. The
 * caller picks the report type (and campus, for reservation changes) and remounts
 * this component with a `key`, so all builder state resets on each selection.
 * Filter values are loaded for the chosen period, then the complete report is
 * retrieved, previewed, and downloaded locally.
 */
export function ReportBuilder({
  kind,
  endpoint,
}: {
  kind: CollectionReportKind
  endpoint: string
}) {
  const [draft, setDraft] = useState<ReportFilters>(() => ({
    ...presetRange("This month"),
    sort: "desc",
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
  const periodOptions = useReportCollection<ReportRecord>(
    kind,
    endpoint,
    { start_date: draft.start_date, end_date: draft.end_date },
    !dateRangeError(draft, true)
  )
  const availableOptions = facetOptions(kind, periodOptions.data ?? [])
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
      const result = (
        await apiClient.post<{ data: ReportPayload }>(
          `${endpoint}/report`,
          {
            filters: draft,
            sections,
            columns,
            compare_previous_period: compare,
          },
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
    <section
      aria-label={`${REPORTS[kind].title} report builder`}
      className="space-y-4"
    >
      <p className="text-sm text-neutral-600">
        Choose a period, preview the complete result, then download PDF or CSV.
        Files are generated locally and are not retained on the server.
      </p>
      <ReportFilterControls
        kind={kind}
        filters={draft}
        onChange={changeFilters}
        options={availableOptions}
        requiredDates
      />
      {periodOptions.isFetching && (
        <p className="text-xs text-neutral-500">
          Loading recorded filter values for this period…
        </p>
      )}
      {periodOptions.isError && (
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
        <legend className="px-1 text-sm font-semibold">Report contents</legend>
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
          Sensitive columns are opt-in. Summary-only reports still aggregate all
          matching records. Maximum period: 366 days; details: 10,000 rows.
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
            Preview required. Filter and content changes invalidate the previous
            preview.
          </p>
        )
      )}
      {preview && !preview.coverage.historical_coverage_complete && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <Checkbox checked={acknowledged} onCheckedChange={setAcknowledged} />
          I acknowledge the coverage limits and understand that this report does
          not represent complete historical records.
        </label>
      )}
      <div className="flex flex-wrap gap-2">
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
      </div>
    </section>
  )
}
