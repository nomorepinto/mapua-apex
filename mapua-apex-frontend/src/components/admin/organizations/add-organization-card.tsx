import type { KeyboardEvent } from "react"
import { DownloadIcon, PlusIcon } from "lucide-react"
import { CircleAlertIcon } from "lucide-react"

import { CsvFileField } from "@/components/admin-osa/csv-file-field"
import {
  ORGANIZATION_ASSIGNABLE_DESK_ITEMS,
  signatoryRoleLabel,
} from "@/components/admin-osa/signatory-roles"
import { ORG_CSV_TEMPLATE } from "@/components/admin/organizations/organization-desks"
import {
  HigherCouncilField,
  SignatoryDeskCombobox,
} from "@/components/admin/organizations/organization-fields"
import { useOrganizationsPage } from "@/components/admin/organizations/organizations-context"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { layout } from "@/config"
import { downloadCsvTemplate } from "@/lib/parse-csv"

/** Prevents typing 0-9 in letters-only fields */
function blockDigitKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault()
  }
}

function stripDigits(value: string): string {
  return value.replace(/[0-9]/g, "")
}

export function AddOrganizationCard() {
  return (
    <Card className={layout.card}>
      <AddOrganizationForm />
      <Separator />
      <ImportOrganizationsCsv />
    </Card>
  )
}

function AddOrganizationForm() {
  const { state, actions } = useOrganizationsPage()

  const nameTrimmed = state.name.trim()
  const hasNumbers = /[0-9]/.test(state.name)
  const isLengthInvalid =
    state.name.length > 0 &&
    (nameTrimmed.length < 5 || nameTrimmed.length > 100)

  const nameError =
    (state.formError &&
      (state.formError.toLowerCase().includes("name") ||
        state.formError.includes("character"))
      ? state.formError
      : null) ??
    (isLengthInvalid
      ? "The required minimum character is 5 and a maximum of 100"
      : null)

  const isNameValid =
    nameTrimmed.length >= 5 &&
    nameTrimmed.length <= 100 &&
    !hasNumbers

  const areDesksValid =
    Boolean(state.desks.adviser) &&
    (state.isHigherCouncil || Boolean(state.desks.dean))

  const canAdd =
    state.canAddOrganization &&
    isNameValid &&
    areDesksValid

  return (
    <>
      <CardHeader>
        <CardTitle>Add organization</CardTitle>
        <CardDescription>
          Admin and CDM are not selected here — they share one account each.
        </CardDescription>
      </CardHeader>
      <Form className="contents" onSubmit={actions.handleAddOne}>
        <CardPanel className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="organization-name">Name</FieldLabel>
            <Input
              aria-invalid={nameError ? true : undefined}
              autoComplete="off"
              id="organization-name"
              name="name"
              minLength={5}
              maxLength={100}
              onKeyDown={blockDigitKeys}
              onChange={(event) =>
                actions.changeName(
                  stripDigits(event.currentTarget.value).slice(0, 100)
                )
              }
              placeholder="Mapua Computing Society"
              required
              type="text"
              value={state.name}
            />
            {nameError ? (
              <p className="text-xs font-medium text-red-600">{nameError}</p>
            ) : null}
          </Field>

          {ORGANIZATION_ASSIGNABLE_DESK_ITEMS.map((item) => (
            <SignatoryDeskCombobox
              emptyLabel={`No ${item.label} registered`}
              items={state.deskOptions[item.value]}
              key={item.value}
              label={item.label}
              onValueChange={(value) => actions.changeDesk(item.value, value)}
              optionalLabel={
                item.value === "dean" && state.isHigherCouncil
                  ? "Not required — higher councils skip the dean desk."
                  : undefined
              }
              placeholder={`Search ${item.label.toLowerCase()}`}
              value={state.desks[item.value]}
            />
          ))}

          <HigherCouncilField
            checked={state.isHigherCouncil}
            id="organization-higher-council"
            onCheckedChange={actions.setIsHigherCouncil}
          />

          {!state.sharedAccountsReady && !state.signatoriesLoading ? (
            <Alert variant="warning">
              <AlertTitle>Shared accounts required</AlertTitle>
              <AlertDescription>
                Register{" "}
                {state.missingShared
                  .map((role) => signatoryRoleLabel(role))
                  .join(", ")}{" "}
                before adding organizations.
              </AlertDescription>
            </Alert>
          ) : null}

          {state.sharedAccountsReady &&
            state.missingAssignable.some(
              (item) => !(item.value === "dean" && state.isHigherCouncil)
            ) &&
            !state.signatoriesLoading ? (
            <Alert variant="warning">
              <AlertTitle>Dean and adviser required</AlertTitle>
              <AlertDescription>
                Register at least one{" "}
                {state.missingAssignable
                  .map((item) => item.label.toLowerCase())
                  .join(" and ")}{" "}
                to assign to this organization.
              </AlertDescription>
            </Alert>
          ) : null}

          {state.formError &&
            !state.formError.toLowerCase().includes("name") &&
            !state.formError.includes("character") ? (
            <Alert variant="error">
              <CircleAlertIcon />
              <AlertTitle>Missing fields</AlertTitle>
              <AlertDescription>{state.formError}</AlertDescription>
            </Alert>
          ) : null}
        </CardPanel>
        <CardFooter className="justify-end">
          <Button
            disabled={!canAdd}
            loading={state.createPending}
            type="submit"
          >
            <PlusIcon aria-hidden="true" />
            Add organization
          </Button>
        </CardFooter>
      </Form>
    </>
  )
}

function ImportOrganizationsCsv() {
  const { state, actions } = useOrganizationsPage()

  return (
    <>
      <CardHeader>
        <CardTitle>Import CSV</CardTitle>
        <CardDescription>
          Four columns: organization name, dean, adviser, is_higher_council. The
          dean may be left empty for higher councils. Shared admin and CDM are
          attached automatically.
        </CardDescription>
      </CardHeader>
      <CardPanel className="flex flex-col gap-4">
        <CsvFileField
          description="name, dean, adviser, is_higher_council."
          error={state.csvError}
          fileName={state.csvFileName}
          id="organizations-csv"
          onFile={actions.chooseCsv}
        />
        {state.csvRowCount > 0 ? (
          <Alert variant="info">
            <AlertTitle>
              {state.csvResolved.payloads.length} new
              {state.csvResolved.skippedDuplicates.length > 0
                ? ` · ${state.csvResolved.skippedDuplicates.length} already registered`
                : ""}
              {state.csvResolved.errors.length > 0
                ? ` · ${state.csvResolved.errors.length} could not be matched`
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
          onClick={() => downloadCsvTemplate("organizations.csv", ORG_CSV_TEMPLATE)}
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden="true" />
          Template
        </Button>
        <Button
          disabled={!state.sharedAccountsReady || state.csvResolved.payloads.length === 0}
          loading={state.bulkPending}
          onClick={actions.handleCsvImport}
          type="button"
          variant="outline"
        >
          Import{" "}
          {state.csvResolved.payloads.length > 0
            ? state.csvResolved.payloads.length
            : ""}{" "}
          {state.csvResolved.payloads.length === 1 ? "org" : "orgs"}
        </Button>
      </CardFooter>
    </>
  )
}
