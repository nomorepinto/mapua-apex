import { DownloadIcon, PlusIcon } from "lucide-react"
import { CircleAlertIcon } from "lucide-react"

import { CsvFileField } from "@/components/admin-osa/csv-file-field"
import {
  ORGANIZATION_ASSIGNABLE_DESK_ITEMS,
  signatoryRoleLabel,
} from "@/components/admin-osa/signatory-roles"
import { ORG_CSV_TEMPLATE } from "@/components/admin/organizations/organization-desks"
import {
  ORGANIZATION_NAME_MAX,
  ORGANIZATION_NAME_MIN,
  blockOrganizationNameDigitKeys,
  isOrganizationNameValid,
  organizationNameLiveError,
  sanitizeOrganizationName,
} from "@/components/admin/organizations/organization-name"
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

  const nameError =
    (state.formError &&
      (state.formError.toLowerCase().includes("name") ||
        state.formError.includes("character"))
      ? state.formError
      : null) ?? organizationNameLiveError(state.name)

  const isNameValid = isOrganizationNameValid(state.name)

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
          CDM is not selected here — every organization shares one CDM account.
          OSAAR approvals are set under Approval stages.
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
              minLength={ORGANIZATION_NAME_MIN}
              maxLength={ORGANIZATION_NAME_MAX}
              onKeyDown={blockOrganizationNameDigitKeys}
              onChange={(event) =>
                actions.changeName(
                  sanitizeOrganizationName(event.currentTarget.value)
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

          {ORGANIZATION_ASSIGNABLE_DESK_ITEMS.map((item) => {
            const deanSkipped = item.value === "dean" && state.isHigherCouncil
            return (
              <SignatoryDeskCombobox
                disabled={deanSkipped}
                emptyLabel={`No ${item.label} registered`}
                items={state.deskOptions[item.value]}
                key={item.value}
                label={item.label}
                onValueChange={(value) => actions.changeDesk(item.value, value)}
                optionalLabel={
                  deanSkipped ? "Skipped for higher councils." : undefined
                }
                placeholder={
                  deanSkipped ? "Skipped" : `Search ${item.label.toLowerCase()}`
                }
                value={deanSkipped ? null : state.desks[item.value]}
              />
            )
          })}

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
          Four columns: organization name, dean, adviser, is_higher_council. A
          higher-council row skips the dean, and any dean name in that row is
          ignored. The shared CDM account is attached automatically.
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
