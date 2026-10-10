import { useMemo, useState, type FormEvent } from "react"
import {
  ArmchairIcon,
  BoxesIcon,
  CircleAlertIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react"

import { CsvFileField } from "@/components/admin-osa/csv-file-field"
import { toastBulkResult } from "@/components/admin/organizations/organization-desks"
import {
  EditReservableDialog,
  type ReservableDraft,
} from "@/components/admin/reservables/reservable-dialogs"
import { RESERVABLE_CSV_TEMPLATE } from "@/components/admin/reservables/reservable-options"
import {
  CampusSelect,
  ReservableTypeField,
} from "@/components/admin/reservables/reservables-fields"
import { useReservablesPage } from "@/components/admin/reservables/reservables-context"
import { ScheduleGrid } from "@/components/admin/reservables/schedule-grid"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toastManager } from "@/components/ui/toast"
import { layout } from "@/config"
import { mutationErrorMessage } from "@/hooks/use-admin"
import {
  allAvailableSchedule,
  countAvailableSlots,
  emptySchedule,
  toggleScheduleDay,
  toggleScheduleSlot,
} from "@/lib/schedule-slots"
import {
  downloadCsvTemplate,
  parseReservableCsv,
  type ReservableCsvRow,
} from "@/lib/parse-csv"
import type { ApiReservable, CreateReservablePayload, ReservableType } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AddReservableSection() {
  const { state, actions } = useReservablesPage()
  const {
    campuses,
    campusId,
    reservables,
    rooms,
    equipment,
    reservablesLoading,
  } = state
  const {
    selectReservable,
    setCampusId,
    createReservable,
    updateReservable,
    deleteReservable,
    bulkCreateReservables,
  } = actions

  const [name, setName] = useState("")
  const [type, setType] = useState<ReservableType>("room")
  const [schedule, setSchedule] = useState(() => allAvailableSchedule())
  const [formError, setFormError] = useState("")
  const [search, setSearch] = useState("")

  const [csvRows, setCsvRows] = useState<ReservableCsvRow[]>([])
  const [csvParseErrors, setCsvParseErrors] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState("")
  const [csvError, setCsvError] = useState("")

  const [editing, setEditing] = useState<ApiReservable | null>(null)
  const [editError, setEditError] = useState("")

  const campusName =
    campuses.find((campus) => campus.campus_id === campusId)?.name ?? ""

  const existingNames = useMemo(
    () => new Set(reservables.map((item) => item.name.trim().toLowerCase())),
    [reservables]
  )

  const csvResolved = useMemo(() => {
    const payloads: CreateReservablePayload[] = []
    const errors: string[] = []
    const skippedDuplicates: string[] = []
    const seen = new Set<string>()

    for (const row of csvRows) {
      const trimmed = row.name.trim()
      const key = trimmed.toLowerCase()
      if (existingNames.has(key) || seen.has(key)) {
        skippedDuplicates.push(trimmed)
        continue
      }
      seen.add(key)
      payloads.push({
        name: trimmed,
        type: row.type,
        // Imported rows start all-available Mon-Sat, then edited on the grid.
        schedule: allAvailableSchedule(),
      })
    }

    return { payloads, errors, skippedDuplicates }
  }, [csvRows, existingNames])

  const query = search.trim().toLowerCase()
  const matches = (item: ApiReservable) =>
    !query || item.name.toLowerCase().includes(query)
  const filteredRooms = rooms.filter(matches)
  const filteredEquipment = equipment.filter(matches)

  async function handleAddOne(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!campusId) {
      setFormError("Choose a campus first.")
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError("Reservable name is required.")
      return
    }
    if (existingNames.has(trimmed.toLowerCase())) {
      setFormError("That reservable already exists on this campus.")
      return
    }
    if (countAvailableSlots(schedule) === 0) {
      setFormError("Select at least one available slot in the weekly template.")
      return
    }

    try {
      await createReservable.mutateAsync({
        campusId,
        name: trimmed,
        type,
        schedule,
      })
      setName("")
      setType("room")
      setSchedule(allAvailableSchedule())
      setFormError("")
      toastManager.add({
        title: "Reservable added",
        description: `${trimmed} is now bookable.`,
        type: "success",
      })
    } catch (error) {
      setFormError(mutationErrorMessage(error, "Could not add reservable."))
    }
  }

  async function handleCsvImport() {
    if (!campusId) {
      setCsvError("Choose a campus first.")
      return
    }
    const errors = [...csvParseErrors, ...csvResolved.errors]
    if (csvResolved.payloads.length === 0) {
      setCsvError(
        errors[0] ??
          (csvRows.length === 0
            ? "Choose a CSV with name and type columns."
            : csvResolved.skippedDuplicates.length > 0
              ? "Every reservable in this file already exists on this campus."
              : "No valid reservable rows to import.")
      )
      return
    }

    const result = await bulkCreateReservables.mutateAsync({
      campusId,
      payloads: csvResolved.payloads,
    })
    const failed = result.failed.length + errors.length
    toastBulkResult(result.created.length, failed, "Reservable")
    if (result.created.length > 0) {
      setCsvRows([])
      setCsvParseErrors([])
      setCsvFileName("")
      setCsvError(errors.length > 0 ? errors.join(" ") : "")
    } else if (errors.length > 0) {
      setCsvError(errors.join(" "))
    }
  }

  async function handleEditSave(draft: ReservableDraft) {
    if (!editing) return
    try {
      await updateReservable.mutateAsync({
        campusId: editing.campus_id,
        reservableId: editing.reservable_id,
        ...draft,
      })
      toastManager.add({
        title: "Reservable updated",
        description: `${draft.name} was saved.`,
        type: "success",
      })
      setEditing(null)
      setEditError("")
    } catch (error) {
      setEditError(mutationErrorMessage(error, "Could not update reservable."))
    }
  }

  async function handleDelete() {
    if (!editing) return
    const removedName = editing.name
    try {
      await deleteReservable.mutateAsync({
        campusId: editing.campus_id,
        reservableId: editing.reservable_id,
      })
      toastManager.add({
        title: "Reservable removed",
        description: `${removedName} was deleted.`,
        type: "success",
      })
      setEditing(null)
      setEditError("")
    } catch (error) {
      setEditError(mutationErrorMessage(error, "Could not delete reservable."))
    }
  }

  const noCampus = !state.campusesLoading && campuses.length === 0

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]",
        layout.gap
      )}
    >
      <Card className={layout.card}>
        {noCampus ? (
          <NoCampusNotice />
        ) : (
          <>
            <CardHeader>
              <CardTitle>Add reservable</CardTitle>
              <CardDescription>
                Pick a campus, name the room or equipment, and mark the weekly
                slots it can be booked. Sunday is never reservable.
              </CardDescription>
            </CardHeader>
            <Form className="contents" onSubmit={handleAddOne}>
              <CardPanel className="flex flex-col gap-4">
                <CampusSelect
                  campuses={campuses}
                  id="add-reservable-campus"
                  onChange={setCampusId}
                  value={campusId}
                />
                <Field>
                  <FieldLabel htmlFor="add-reservable-name">Name</FieldLabel>
                  <Input
                    aria-invalid={formError ? true : undefined}
                    autoComplete="off"
                    id="add-reservable-name"
                    onChange={(event) => {
                      setName(event.currentTarget.value)
                      if (formError) setFormError("")
                    }}
                    placeholder="Cardinal Cinema"
                    required
                    type="text"
                    value={name}
                  />
                </Field>
                <ReservableTypeField
                  id="add-reservable-type"
                  onChange={(next) => {
                    setType(next)
                    if (formError) setFormError("")
                  }}
                  value={type}
                />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-base/4.5 font-medium text-foreground sm:text-sm/4">Weekly availability</span>
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => setSchedule(allAvailableSchedule())}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        All week
                      </Button>
                      <Button
                        onClick={() => setSchedule(emptySchedule())}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  <ScheduleGrid
                    onToggle={(day, slot) =>
                      setSchedule((current) =>
                        toggleScheduleSlot(current, day, slot)
                      )
                    }
                    onToggleDay={(day) =>
                      setSchedule((current) => toggleScheduleDay(current, day))
                    }
                    schedule={schedule}
                  />
                </div>
                {formError ? (
                  <Alert variant="error">
                    <CircleAlertIcon />
                    <AlertTitle>Missing details</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
              </CardPanel>
              <CardFooter className="justify-end">
                <Button
                  disabled={!campusId || !name.trim()}
                  loading={createReservable.isPending}
                  type="submit"
                >
                  <PlusIcon aria-hidden="true" />
                  Add reservable
                </Button>
              </CardFooter>
            </Form>
            <Separator />
            <ImportReservablesCsv
              csvError={csvError}
              csvFileName={csvFileName}
              onChooseCsv={(file, text) => {
                if (!file) {
                  setCsvRows([])
                  setCsvParseErrors([])
                  setCsvFileName("")
                  setCsvError("")
                  return
                }
                const parsed = parseReservableCsv(text)
                setCsvFileName(file.name)
                setCsvRows(parsed.rows)
                setCsvParseErrors(parsed.errors)
                setCsvError(parsed.errors[0] ?? "")
              }}
              onImport={handleCsvImport}
              pending={bulkCreateReservables.isPending}
              readyCount={csvResolved.payloads.length}
              skipped={csvResolved.skippedDuplicates.length}
            />
          </>
        )}
      </Card>

      <Card className={cn(layout.card, "min-w-0")}>
        <CardHeader>
          <CardTitle>Existing reservables</CardTitle>
          <CardDescription>
            {reservablesLoading
              ? "Loading…"
              : `${reservables.length} on ${campusName || "this campus"} · select to view`}
          </CardDescription>
          <CardAction>
            <Input
              aria-label="Search reservables"
              className="w-full min-w-0 sm:w-40"
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search"
              type="search"
              value={search}
            />
          </CardAction>
        </CardHeader>
        <CardPanel className="p-0">
          {reservablesLoading ? (
            <div className="space-y-2 px-4 pb-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : reservables.length === 0 ? (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BoxesIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No reservables yet</EmptyTitle>
                <EmptyDescription>
                  Add rooms and equipment to start taking reservations.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <ReservableBucket
                icon={ArmchairIcon}
                items={filteredRooms}
                onEdit={setEditing}
                onSelect={(id) => selectReservable(id, "view")}
                title="Rooms"
              />
              <ReservableBucket
                icon={BoxesIcon}
                items={filteredEquipment}
                onEdit={setEditing}
                onSelect={(id) => selectReservable(id, "view")}
                title="Equipment"
              />
            </div>
          )}
        </CardPanel>
      </Card>

      {editing ? (
        <EditReservableDialog
          campusName={
            campuses.find((campus) => campus.campus_id === editing.campus_id)
              ?.name ?? ""
          }
          deletePending={deleteReservable.isPending}
          error={editError}
          key={editing.reservable_id}
          onClose={() => {
            setEditing(null)
            setEditError("")
          }}
          onDelete={handleDelete}
          onSave={handleEditSave}
          reservable={editing}
          reservables={reservables}
          savePending={updateReservable.isPending}
        />
      ) : null}
    </div>
  )
}

function NoCampusNotice() {
  return (
    <>
      <CardHeader>
        <CardTitle>Add reservable</CardTitle>
        <CardDescription>
          Reservables belong to a campus.
        </CardDescription>
      </CardHeader>
      <CardPanel>
        <Alert variant="warning">
          <AlertTitle>No campuses yet</AlertTitle>
          <AlertDescription>
            Ask OSAAR to register a campus first (OSAAR → Campuses), then add
            its rooms and equipment here.
          </AlertDescription>
        </Alert>
      </CardPanel>
    </>
  )
}

function ImportReservablesCsv({
  csvError,
  csvFileName,
  onChooseCsv,
  onImport,
  pending,
  readyCount,
  skipped,
}: {
  csvError: string
  csvFileName: string
  onChooseCsv: (file: File | null, text: string) => void
  onImport: () => void
  pending: boolean
  readyCount: number
  skipped: number
}) {
  return (
    <>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          Two columns: name and type (room or equipment). Imported rows start
          all-available Mon-Sat — refine each on the grid afterwards.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <CsvFileField
          description="name, type."
          error={csvError}
          fileName={csvFileName}
          id="reservables-csv"
          onFile={onChooseCsv}
        />
        {readyCount > 0 ? (
          <Alert variant="info">
            <AlertTitle>
              {readyCount} new
              {skipped > 0 ? ` · ${skipped} already exist` : ""}
            </AlertTitle>
          </Alert>
        ) : null}
      </CardPanel>
      <CardFooter className="justify-between gap-2">
        <Button
          onClick={() =>
            downloadCsvTemplate("reservables.csv", RESERVABLE_CSV_TEMPLATE)
          }
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden="true" />
          Template
        </Button>
        <Button
          disabled={readyCount === 0}
          loading={pending}
          onClick={onImport}
          type="button"
          variant="outline"
        >
          Import {readyCount > 0 ? readyCount : ""}{" "}
          {readyCount === 1 ? "reservable" : "reservables"}
        </Button>
      </CardFooter>
    </>
  )
}

function ReservableBucket({
  title,
  icon: Icon,
  items,
  onSelect,
  onEdit,
}: {
  title: string
  icon: typeof ArmchairIcon
  items: ApiReservable[]
  onSelect: (reservableId: string) => void
  onEdit: (reservable: ApiReservable) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <Icon aria-hidden="true" className="size-3.5" />
        {title}
        <span className="text-neutral-400">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">None</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white pe-1"
              key={item.reservable_id}
            >
              <button
                className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
                onClick={() => onSelect(item.reservable_id)}
                title={`View ${item.name}`}
                type="button"
              >
                {item.name}
              </button>
              <Button
                aria-label={`Edit ${item.name}`}
                onClick={() => onEdit(item)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <PencilIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
