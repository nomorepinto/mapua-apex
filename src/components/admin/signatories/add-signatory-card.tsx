import { CircleAlertIcon, DownloadIcon, PlusIcon } from "lucide-react"

import { CsvFileField } from "@/components/admin-osa/csv-file-field"
import { signatoryRoleLabel } from "@/components/admin-osa/signatory-roles"
import { DepartmentSelect } from "@/components/admin/signatories/department-select"
import { SIGNATORY_CSV_TEMPLATE } from "@/components/admin/signatories/signatory-options"
import { useSignatoriesPage } from "@/components/admin/signatories/signatories-context"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { layout } from "@/config"
import { downloadCsvTemplate } from "@/lib/parse-csv"

export function AddSignatoryCard() {
  return (
    <Card className={layout.card}>
      <AddSignatoryForm />
      <Separator />
      <ImportSignatoriesCsv />
    </Card>
  )
}

function AddSignatoryForm() {
  const { state, actions } = useSignatoriesPage()

  return (
    <>
      <CardHeader>
        <CardTitle>Add signatory</CardTitle>
        <CardDescription>
          Required fields: <code>name</code> and <code>role</code>. Department
          is optional for deans.
        </CardDescription>
      </CardHeader>
      <Form className="contents" onSubmit={actions.handleAddOne}>
        <CardPanel className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="signatory-name">Name</FieldLabel>
            <Input
              autoComplete="off"
              id="signatory-name"
              name="name"
              onChange={(event) => actions.changeName(event.currentTarget.value)}
              placeholder="Prof. Juan Dela Cruz"
              required
              type="text"
              value={state.name}
            />
          </Field>

          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select
              itemToStringValue={(item) => item.value}
              items={state.roleItems}
              name="role"
              onValueChange={(item) => actions.changeRole(item?.value ?? null)}
              value={state.selectedRole}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectPopup>
                {state.roleItems.map((item) => (
                  <SelectItem key={item.value} value={item}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldDescription>
              Dean, adviser, admin, CDM, or OSAAR. Admin, CDM, and OSAAR are
              limited to one account each.
            </FieldDescription>
          </Field>

          {state.role === "dean" ? (
            <DepartmentSelect
              items={state.departmentItems}
              onValueChange={actions.setDepartment}
              value={state.department}
            />
          ) : null}

          {state.takenRoles.size > 0 ? (
            <Alert variant="info">
              <AlertTitle>Shared accounts registered</AlertTitle>
              <AlertDescription>
                {[...state.takenRoles]
                  .map((item) => signatoryRoleLabel(item))
                  .join(", ")}{" "}
                already exist and cannot be added again.
              </AlertDescription>
            </Alert>
          ) : null}

          {state.formError ? (
            <Alert variant="error">
              <CircleAlertIcon />
              <AlertTitle>Missing fields</AlertTitle>
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          ) : null}
        </CardPanel>
        <CardFooter className="justify-end">
          <Button loading={state.createPending} type="submit">
            <PlusIcon aria-hidden="true" />
            Add signatory
          </Button>
        </CardFooter>
      </Form>
    </>
  )
}

function ImportSignatoriesCsv() {
  const { state, actions } = useSignatoriesPage()

  return (
    <>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          Columns: name, role, and optional department for deans.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <CsvFileField
          description="name, role, department."
          error={state.csvError}
          fileName={state.csvFileName}
          id="signatories-csv"
          onFile={actions.chooseCsv}
        />
        {state.csvRecordCount > 0 ? (
          <Alert variant="info">
            <AlertTitle>
              {state.csvPayloads.payloads.length} signatory row
              {state.csvPayloads.payloads.length === 1 ? "" : "s"}
            </AlertTitle>
            <AlertDescription>
              Extra admin, CDM, or OSAAR rows are skipped. Department is ignored
              unless the role is dean.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardPanel>
      <CardFooter className="justify-between gap-2">
        <Button
          onClick={() =>
            downloadCsvTemplate("signatories.csv", SIGNATORY_CSV_TEMPLATE)
          }
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden="true" />
          Template
        </Button>
        <Button
          disabled={state.csvPayloads.payloads.length === 0}
          loading={state.bulkPending}
          onClick={actions.handleCsvImport}
          type="button"
          variant="outline"
        >
          Import CSV
        </Button>
      </CardFooter>
    </>
  )
}
