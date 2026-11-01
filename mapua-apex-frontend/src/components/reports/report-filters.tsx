import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DATE_PRESETS,
  REPORTS,
  dateRangeError,
  presetRange,
  type FacetOptions,
  type ReportFilters,
  type ReportKind,
} from "@/lib/reporting"

export function ReportSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Record<string, string>
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-36 space-y-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue>{options[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {Object.entries(options).map(([key, title]) => (
            <SelectItem key={key} value={key}>
              {title}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  )
}

function SearchInput({
  value,
  onChange,
  immediate = false,
}: {
  value: string
  onChange: (value: string) => void
  immediate?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [previous, setPrevious] = useState(value)
  if (previous !== value) {
    setPrevious(value)
    setDraft(value)
  }
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 300)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])
  return (
    <div className="min-w-48 flex-1 space-y-1">
      <label className="text-xs font-medium text-neutral-600">
        Search
        <Input
          aria-label="Search records"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            if (immediate) onChange(event.target.value)
          }}
          placeholder="Title, ID, organization, or user"
          maxLength={200}
        />
      </label>
    </div>
  )
}

function DateRangeInputs({
  filters,
  onChange,
  required,
  allowAllDates,
}: {
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
  required: boolean
  allowAllDates: boolean
}) {
  const [start, setStart] = useState(filters.start_date ?? "")
  const [end, setEnd] = useState(filters.end_date ?? "")
  const current = `${filters.start_date ?? ""}/${filters.end_date ?? ""}`
  const [previous, setPrevious] = useState(current)
  if (previous !== current) {
    setPrevious(current)
    setStart(filters.start_date ?? "")
    setEnd(filters.end_date ?? "")
  }
  const error = dateRangeError(
    { start_date: start || undefined, end_date: end || undefined },
    required || !allowAllDates
  )
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs font-medium text-neutral-600">
          Start date (Manila)
          <Input
            type="date"
            aria-label="Start date (Manila)"
            value={start}
            onChange={(event) => {
              setStart(event.target.value)
              if (required)
                onChange({
                  ...filters,
                  start_date: event.target.value || undefined,
                })
            }}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-neutral-600">
          End date (Manila)
          <Input
            type="date"
            aria-label="End date (Manila)"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value)
              if (required)
                onChange({
                  ...filters,
                  end_date: event.target.value || undefined,
                })
            }}
          />
        </label>
        {!required && (
          <Button
            variant="outline"
            disabled={Boolean(error)}
            onClick={() =>
              onChange({
                ...filters,
                start_date: start || undefined,
                end_date: end || undefined,
              })
            }
          >
            Apply dates
          </Button>
        )}
        {!required && allowAllDates && (
          <Button
            variant="ghost"
            onClick={() => {
              setStart("")
              setEnd("")
              onChange({
                ...filters,
                start_date: undefined,
                end_date: undefined,
              })
            }}
          >
            All dates
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function ReportMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
}) {
  const [search, setSearch] = useState("")
  const choices = options.filter((item) =>
    item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  )
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        {label}
        {selected.length ? ` (${selected.length})` : ""}
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-72">
        <div className="space-y-3">
          <Input
            aria-label={`Search ${label}`}
            placeholder={`Search ${label.toLowerCase()}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {choices.map((item) => (
              <label
                key={item.value}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <Checkbox
                  checked={selected.includes(item.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, item.value]
                        : selected.filter((value) => value !== item.value)
                    )
                  }
                />
                <span className="break-words">{item.label}</span>
              </label>
            ))}
            {!choices.length && (
              <p className="text-sm text-neutral-500">
                No recorded values in this scope.
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear {label.toLowerCase()}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  )
}

export function ReportFilterControls({
  kind,
  filters,
  onChange,
  options = {},
  onReset,
  count,
  requiredDates = false,
  allowAllDates = true,
}: {
  kind: ReportKind
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
  options?: FacetOptions
  onReset?: () => void
  count?: number
  requiredDates?: boolean
  allowAllDates?: boolean
}) {
  const definition = REPORTS[kind]
  const [resetVersion, setResetVersion] = useState(0)
  const reset = () => {
    setResetVersion((value) => value + 1)
    if (onReset) onReset()
    else
      onChange(
        requiredDates || !allowAllDates
          ? { ...presetRange("This month"), sort: "desc" }
          : { sort: "desc" }
      )
  }
  const preset =
    DATE_PRESETS.find(
      (name) =>
        name !== "Custom" &&
        presetRange(name).start_date === filters.start_date &&
        presetRange(name).end_date === filters.end_date
    ) ?? "Custom"
  const choose = (field: string, values: string[]) =>
    onChange({ ...filters, values: { ...filters.values, [field]: values } })
  return (
    <section
      aria-label={`${definition.title} filters`}
      className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <ReportSelect
          label="Date preset"
          value={preset}
          options={Object.fromEntries(DATE_PRESETS.map((name) => [name, name]))}
          onChange={(value) => {
            if (value !== "Custom")
              onChange({ ...filters, ...presetRange(value) })
          }}
        />
        <ReportSelect
          label="Date basis"
          value={filters.date_basis ?? Object.keys(definition.dates)[0]}
          options={definition.dates}
          onChange={(date_basis) => onChange({ ...filters, date_basis })}
        />
        <ReportSelect
          label="Sort"
          value={filters.sort ?? "desc"}
          options={{ desc: "Newest first", asc: "Oldest first" }}
          onChange={(sort) =>
            onChange({ ...filters, sort: sort as "asc" | "desc" })
          }
        />
        <SearchInput
          key={resetVersion}
          immediate={requiredDates}
          value={filters.search ?? ""}
          onChange={(search) => onChange({ ...filters, search })}
        />
      </div>
      <DateRangeInputs
        key={resetVersion}
        filters={filters}
        onChange={onChange}
        required={requiredDates}
        allowAllDates={allowAllDates}
      />
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(definition.facets)
          .filter(
            ([field]) =>
              options[field]?.length || filters.values?.[field]?.length
          )
          .map(([field, label]) => (
            <ReportMultiSelect
              key={field}
              label={label}
              options={options[field] ?? []}
              selected={filters.values?.[field] ?? []}
              onChange={(values) => choose(field, values)}
            />
          ))}
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset all
        </Button>
        <span className="ml-auto text-xs text-neutral-600" aria-live="polite">
          {count === undefined
            ? ""
            : `${count.toLocaleString()} matching records`}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(filters.values ?? {}).flatMap(([field, values]) =>
          values.map((value) => (
            <Button
              key={`${field}:${value}`}
              variant="secondary"
              size="sm"
              aria-label={`Remove ${definition.facets[field]}: ${options[field]?.find((item) => item.value === value)?.label ?? value}`}
              onClick={() =>
                choose(
                  field,
                  values.filter((item) => item !== value)
                )
              }
            >
              {definition.facets[field]}:{" "}
              {options[field]?.find((item) => item.value === value)?.label ??
                value}
              <X className="size-3" />
            </Button>
          ))
        )}
        {filters.search && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange({ ...filters, search: "" })}
          >
            Search: {filters.search}
            <X className="size-3" />
          </Button>
        )}
      </div>
    </section>
  )
}
