import { DownloadIcon, PlusIcon } from "lucide-react"

import { CsvFileField } from "@/components/admin-osa/csv-file-field"
import { CAMPUS_CSV_TEMPLATE } from "@/components/admin/campuses/campus-options"
import { useCampusesPage } from "@/components/admin/campuses/campuses-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { layout } from "@/config"
import { downloadCsvTemplate } from "@/lib/parse-csv"

export function AddCampusCard() {
  return (
    <Card className={layout.card}>
      <AddCampusForm />
      <Separator />
      <ImportCampusesCsv />
    </Card>
  )
}

function AddCampusForm() {
  const { state, actions } = useCampusesPage()

  return (
    <>
      <CardHeader>
        <CardTitle>Add campus</CardTitle>
        <CardDescription>
          A campus groups its reservable rooms and equipment. CDM adds those
          next.
        </CardDescription>
      </CardHeader>
      <Form className="contents" onSubmit={actions.handleAddOne}>
        <CardPanel className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="campus-name">Name</FieldLabel>
            <Input
              aria-invalid={state.formError ? true : undefined}
              autoComplete="off"
              id="campus-name"
              name="name"
              onChange={(event) => actions.changeName(event.currentTarget.value)}
              placeholder="Makati Campus"
              required
              type="text"
              value={state.name}
            />
            {state.formError ? <FieldError>{state.formError}</FieldError> : null}
          </Field>
        </CardPanel>
        <CardFooter className="justify-end">
          <Button
            disabled={!state.name.trim()}
            loading={state.createPending}
            type="submit"
          >
            <PlusIcon aria-hidden="true" />
            Add campus
          </Button>
        </CardFooter>
      </Form>
    </>
  )
}

function ImportCampusesCsv() {
  const { state, actions } = useCampusesPage()

  return (
    <>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          One column: campus name. Duplicate names are skipped automatically.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <CsvFileField
          description="name."
          error={state.csvError}
          fileName={state.csvFileName}
          id="campuses-csv"
          onFile={actions.chooseCsv}
        />
        {state.csvRowCount > 0 ? (
          <Alert variant="info">
            <AlertTitle>
              {state.csvResolved.payloads.length} new
              {state.csvResolved.skippedDuplicates.length > 0
                ? ` · ${state.csvResolved.skippedDuplicates.length} already registered`
                : ""}
            </AlertTitle>
            <AlertDescription>
              {state.csvResolved.payloads
                .slice(0, 8)
                .map((row) => row.name)
                .join(", ")}
              {state.csvResolved.payloads.length > 8
                ? ` and ${state.csvResolved.payloads.length - 8} more`
                : ""}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardPanel>
      <CardFooter className="justify-between gap-2">
        <Button
          onClick={() => downloadCsvTemplate("campuses.csv", CAMPUS_CSV_TEMPLATE)}
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden="true" />
          Template
        </Button>
        <Button
          disabled={state.csvResolved.payloads.length === 0}
          loading={state.bulkPending}
          onClick={actions.handleCsvImport}
          type="button"
          variant="outline"
        >
          Import{" "}
          {state.csvResolved.payloads.length > 0
            ? state.csvResolved.payloads.length
            : ""}{" "}
          {state.csvResolved.payloads.length === 1 ? "campus" : "campuses"}
        </Button>
      </CardFooter>
    </>
  )
}
