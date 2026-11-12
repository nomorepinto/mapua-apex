import { useEffect, useMemo, useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { useBeforeUnload, useBlocker } from "react-router"
import {
  mutationErrorMessage,
  useTermSettingsQuery,
  useUpdateTermSettingsMutation,
  type ApiAcademicTerm,
  type ApiAcademicYear,
  type ApiTermBlackout,
} from "@/hooks/use-admin"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { layout } from "@/config"

const id = () => crypto.randomUUID()
const termName = (count: number, index: number) =>
  `${count === 2 ? "Semester" : count === 3 ? "Trimester" : count === 4 ? "Quarter" : "Term"} ${index + 1}`
const emptyTerm = (): ApiAcademicTerm => ({
  id: id(),
  label: "Term 1",
  start: "",
  end: "",
  blackouts: [],
})
const emptyYear = (): ApiAcademicYear => ({
  id: id(),
  label: "",
  terms: [emptyTerm()],
})
const DEFAULT_EVENT_FILING_LEAD_DAYS = 10

export function TermSettingsCard() {
  const query = useTermSettingsQuery()
  const save = useUpdateTermSettingsMutation()
  const [years, setYears] = useState<ApiAcademicYear[]>([emptyYear()])
  const [eventFilingLeadDays, setEventFilingLeadDays] = useState(
    DEFAULT_EVENT_FILING_LEAD_DAYS
  )
  const [activeId, setActiveId] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [customLabels, setCustomLabels] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  useEffect(() => {
    if (query.data) {
      setYears(query.data.academic_years)
      setActiveId(query.data.active_academic_year_id)
      setSelectedId(query.data.active_academic_year_id)
      setEventFilingLeadDays(query.data.event_filing_lead_days)
    }
  }, [query.data])
  const selected = useMemo(
    () => years.find((year) => year.id === selectedId) ?? years[0],
    [years, selectedId]
  )
  const patchYear = (next: Partial<ApiAcademicYear>) =>
    selected &&
    setYears((rows) =>
      rows.map((year) =>
        year.id === selected.id ? { ...year, ...next } : year
      )
    )
  const relabel = (terms: ApiAcademicTerm[]) =>
    terms.map((term, index) =>
      customLabels.has(term.id)
        ? term
        : { ...term, label: termName(terms.length, index) }
    )
  const patchTerms = (next: ApiAcademicTerm[]) =>
    patchYear({ terms: relabel(next) })
  const patchTerm = (index: number, next: Partial<ApiAcademicTerm>) =>
    selected &&
    patchTerms(
      selected.terms.map((term, row) =>
        row === index ? { ...term, ...next } : term
      )
    )
  const patchBlackout = (
    termIndex: number,
    blackoutIndex: number,
    next: Partial<ApiTermBlackout>
  ) =>
    selected &&
    patchTerm(termIndex, {
      blackouts: selected.terms[termIndex].blackouts.map((row, index) =>
        index === blackoutIndex ? { ...row, ...next } : row
      ),
    })
  const addYear = () => {
    const year = emptyYear()
    setYears((rows) => [...rows, year])
    setSelectedId(year.id)
  }
  const removeYear = () => {
    if (!selected || years.length === 1 || selected.id === activeId) return
    const rest = years.filter((year) => year.id !== selected.id)
    setYears(rest)
    setSelectedId(rest[0].id)
  }
  const saveCalendar = async () => {
    setError("")
    try {
      await save.mutateAsync({
        active_academic_year_id: activeId,
        academic_years: years,
        event_filing_lead_days: eventFilingLeadDays,
      })
    } catch (next) {
      setError(mutationErrorMessage(next, "Could not save academic calendar."))
    }
  }
  if (!selected) return null
  const valid = Boolean(
    activeId &&
    Number.isInteger(eventFilingLeadDays) &&
    eventFilingLeadDays >= 0 &&
    eventFilingLeadDays <= 90 &&
    years.every(
      (year) =>
        year.label.trim() &&
        year.terms.length > 0 &&
        year.terms.every((term) => term.label.trim() && term.start && term.end)
    )
  )
  const hasUnsavedChanges = Boolean(
    query.data &&
    (eventFilingLeadDays !== query.data.event_filing_lead_days ||
      activeId !== query.data.active_academic_year_id ||
      JSON.stringify(years) !== JSON.stringify(query.data.academic_years))
  )
  const navigationBlocker = useBlocker(hasUnsavedChanges)
  useBeforeUnload((event) => {
    if (!hasUnsavedChanges) return
    event.preventDefault()
    event.returnValue = ""
  })
  return (
    <Card className={layout.card}>
      <CardHeader>
        <CardTitle>Academic calendar</CardTitle>
        <CardDescription>
          Select an academic year to plan its terms. The active academic year
          controls event-date filing rules.
        </CardDescription>
      </CardHeader>
      <CardPanel className="space-y-5">
        {query.isError ? (
          <Alert variant="error">
            <AlertTitle>Could not load calendar</AlertTitle>
            <AlertDescription>Refresh the page and try again.</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-3 rounded-xl border bg-neutral-50/60 p-3 sm:flex-row sm:items-end">
          <div className="min-w-56 flex-1 space-y-1">
            <label className="text-xs font-semibold">Academic year</label>
            <Select
              value={selected.id}
              onValueChange={(value) => setSelectedId(value ?? selected.id)}
            >
              <SelectTrigger aria-label="Academic year">
                <SelectValue>
                  {selected.label || "Untitled academic year"}
                  {selected.id === activeId ? " (Active)" : ""}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.label || "Untitled academic year"}
                    {year.id === activeId ? " (Active)" : ""}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
          <Button variant="outline" onClick={addYear}>
            <PlusIcon /> New academic year
          </Button>
          <Button
            variant="destructive-outline"
            disabled={years.length === 1 || selected.id === activeId}
            onClick={removeYear}
          >
            <Trash2Icon /> Delete year
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Academic-year label</label>
            <Input
              value={selected.label}
              onChange={(event) => patchYear({ label: event.target.value })}
              placeholder="e.g. AY 2026-2027"
            />
          </div>
          <Button
            variant={selected.id === activeId ? "secondary" : "outline"}
            onClick={() => setActiveId(selected.id)}
          >
            {selected.id === activeId ? "Active academic year" : "Make active"}
          </Button>
        </div>
        <div className="max-w-sm space-y-1">
          <label
            className="text-xs font-semibold"
            htmlFor="event-filing-lead-days"
          >
            Minimum lead time for event filing (calendar days)
          </label>
          <Input
            id="event-filing-lead-days"
            type="number"
            min="0"
            max="90"
            step="1"
            value={eventFilingLeadDays}
            onChange={(event) =>
              setEventFilingLeadDays(Number(event.target.value))
            }
          />
          <p className="text-xs text-muted-foreground">
            Organizations must file events at least this many Manila calendar
            days in advance.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Terms</h3>
            <p className="text-xs text-muted-foreground">
              {selected.terms.length} of 5 terms. Names adjust automatically
              until you edit them.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.terms.length >= 5}
            onClick={() => patchTerms([...selected.terms, emptyTerm()])}
          >
            <PlusIcon /> Add term
          </Button>
        </div>
        <div className="flex [scrollbar-width:thin] gap-4 overflow-x-auto pb-2">
          {selected.terms.map((term, index) => (
            <section
              className="min-w-[19rem] flex-1 space-y-3 rounded-xl border p-4 md:min-w-[21rem]"
              key={term.id}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {term.label || `Term ${index + 1}`}
                </h4>
                <Button
                  aria-label={`Remove term ${index + 1}`}
                  size="icon"
                  variant="destructive-outline"
                  disabled={selected.terms.length === 1}
                  onClick={() =>
                    patchTerms(selected.terms.filter((_, row) => row !== index))
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <Input
                  value={term.label}
                  onChange={(event) => {
                    setCustomLabels((ids) => new Set(ids).add(term.id))
                    patchTerm(index, { label: event.target.value })
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Start</label>
                  <DatePicker
                    value={term.start}
                    onChange={(start) => patchTerm(index, { start })}
                    aria-label={`${term.label} start`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">End</label>
                  <DatePicker
                    value={term.end}
                    minDate={term.start || undefined}
                    onChange={(end) => patchTerm(index, { end })}
                    aria-label={`${term.label} end`}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                New event dates lock 14 days before this term ends.
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                <div className="flex justify-between gap-2">
                  <span className="text-xs font-medium">Blackouts</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patchTerm(index, {
                        blackouts: [
                          ...term.blackouts,
                          { start: "", end: "", reason: "" },
                        ],
                      })
                    }
                  >
                    <PlusIcon /> Add
                  </Button>
                </div>
                {term.blackouts.map((row, blackoutIndex) => (
                  <div
                    className="grid grid-cols-2 gap-2 rounded-lg border p-2"
                    key={`${row.start}-${blackoutIndex}`}
                  >
                    <DatePicker
                      value={row.start}
                      minDate={term.start || undefined}
                      onChange={(start) =>
                        patchBlackout(index, blackoutIndex, { start })
                      }
                      aria-label="Blackout start"
                    />
                    <DatePicker
                      value={row.end}
                      minDate={row.start || term.start || undefined}
                      onChange={(end) =>
                        patchBlackout(index, blackoutIndex, { end })
                      }
                      aria-label="Blackout end"
                    />
                    <Input
                      className="col-span-2"
                      value={row.reason}
                      onChange={(event) =>
                        patchBlackout(index, blackoutIndex, {
                          reason: event.target.value,
                        })
                      }
                      placeholder="Reason"
                    />
                    <Button
                      className="col-span-2"
                      size="sm"
                      variant="destructive-outline"
                      onClick={() =>
                        patchTerm(index, {
                          blackouts: term.blackouts.filter(
                            (_, rowIndex) => rowIndex !== blackoutIndex
                          ),
                        })
                      }
                    >
                      Remove blackout
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        {error ? (
          <Alert variant="error">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardPanel>
      <CardFooter className="flex items-center justify-between gap-3">
        {hasUnsavedChanges ? (
          <p className="text-sm font-medium text-amber-700" role="status">
            Unsaved changes — save the academic calendar to apply them.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            All academic calendar changes are saved.
          </p>
        )}
        <Button
          disabled={!valid || !hasUnsavedChanges}
          loading={save.isPending}
          onClick={() => void saveCalendar()}
        >
          {hasUnsavedChanges
            ? "Save academic calendar"
            : "Academic calendar saved"}
        </Button>
      </CardFooter>
      <AlertDialog
        open={navigationBlocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open) navigationBlocker.reset?.()
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              Your academic-calendar changes have not been saved. Save them
              before switching setup sections or navigating to another page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigationBlocker.reset?.()}
            >
              Stay and save
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => navigationBlocker.proceed?.()}
            >
              Leave without saving
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </Card>
  )
}
