import { DownloadIcon, PlusIcon } from "lucide-react"

import { CsvFileField } from "@/components/admin-osa/csv-file-field"
import { useMembersPage } from "@/components/students/members/members-context"
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
import { downloadCsvTemplate, MEMBER_CSV_TEMPLATE } from "@/lib/parse-csv"

export function AddMemberCard() {
  return (
    <Card className={layout.card}>
      <AddMemberForm />
      <Separator />
      <ImportMembersCsv />
    </Card>
  )
}

function AddMemberForm() {
  const { state, actions } = useMembersPage()

  return (
    <>
      <CardHeader>
        <CardTitle>Add member</CardTitle>
        <CardDescription>
          Add a student to your organization roster.
        </CardDescription>
      </CardHeader>
      <Form className="contents" onSubmit={actions.handleAddOne}>
        <CardPanel className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="member-lastname">Last name</FieldLabel>
            <Input
              autoComplete="off"
              id="member-lastname"
              name="lastname"
              onChange={(event) => actions.changeLastname(event.currentTarget.value)}
              placeholder="Dela Cruz"
              required
              type="text"
              value={state.lastname}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-firstname">First name</FieldLabel>
            <Input
              autoComplete="off"
              id="member-firstname"
              name="firstname"
              onChange={(event) => actions.changeFirstname(event.currentTarget.value)}
              placeholder="Juan"
              required
              type="text"
              value={state.firstname}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-student-number">Student number</FieldLabel>
            <Input
              aria-invalid={state.formError ? true : undefined}
              autoComplete="off"
              id="member-student-number"
              name="student_number"
              onChange={(event) =>
                actions.changeStudentNumber(event.currentTarget.value)
              }
              placeholder="202100001"
              required
              type="text"
              value={state.studentNumber}
            />
            {state.formError ? <FieldError>{state.formError}</FieldError> : null}
          </Field>
        </CardPanel>
        <CardFooter className="justify-end">
          <Button loading={state.createPending} type="submit">
            <PlusIcon aria-hidden="true" />
            Add member
          </Button>
        </CardFooter>
      </Form>
    </>
  )
}

function ImportMembersCsv() {
  const { state, actions } = useMembersPage()

  const newCount = state.csvRows.filter(
    (row) =>
      !state.members.some(
        (m) => m.student_number.toLowerCase() === row.student_number.toLowerCase()
      )
  ).length

  return (
    <>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          Three columns: lastname, firstname, student_number. A header row is
          optional.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <CsvFileField
          description="lastname, firstname, student_number."
          error={state.csvError}
          fileName={state.csvFileName}
          id="members-csv"
          onFile={actions.chooseCsv}
        />
        {state.csvRowCount > 0 ? (
          <p className="text-muted-foreground text-sm">
            {newCount} new · {state.csvRowCount - newCount} already in roster
            {state.csvParseErrors.length > 0
              ? ` · ${state.csvParseErrors.length} errors`
              : ""}
          </p>
        ) : null}
      </CardPanel>
      <CardFooter className="justify-between gap-2">
        <Button
          onClick={() => downloadCsvTemplate("members.csv", MEMBER_CSV_TEMPLATE)}
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden="true" />
          Template
        </Button>
        <Button
          disabled={newCount === 0}
          loading={state.bulkPending}
          onClick={actions.handleCsvImport}
          type="button"
          variant="outline"
        >
          Import {newCount > 0 ? newCount : ""}{" "}
          {newCount === 1 ? "member" : "members"}
        </Button>
      </CardFooter>
    </>
  )
}
