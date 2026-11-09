import { useState } from "react"
import {
  CircleAlertIcon,
  Loader2,
  PlusIcon,
  UsersIcon,
} from "lucide-react"

import { ProponentCard } from "@/components/submission/proponent-card"
import {
  getDepartmentItem,
  MAX_PROPONENTS,
  SELECT_CONTENT_STYLE,
  SELECT_ITEM_CLASS,
} from "@/components/submission/constants"
import type { Proponent } from "@/components/submission/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCurrentOrganizationQuery, useOfficersQuery } from "@/hooks/use-submissions"
import { layout } from "@/config"
import { cn } from "@/lib/utils"
import type { ApiOfficer } from "@/lib/dynamodb-adapters"

function officerFullName(officer: ApiOfficer): string {
  return [officer.first_name, officer.middle_name, officer.last_name, officer.suffix]
    .filter(Boolean)
    .join(" ")
}

/** Map an officer roster entry onto a fresh proponent. */
function officerToProponent(officer: ApiOfficer, id: string): Proponent {
  return {
    id,
    position: officer.position_of_applicant ?? "",
    firstName: officer.first_name ?? "",
    middleName: officer.middle_name ?? "",
    lastName: officer.last_name ?? "",
    suffix: officer.suffix ?? "",
    studentNumber: officer.student_number ?? "",
    programAndYear: officer.program_and_year ?? "",
    dateOfSubmission: "",
    department: "",
    positionOfApplicant: officer.position_of_applicant ?? "",
    orgOrCourseSection: "", // filled from organizationName at render time
    contactNumber: officer.contact_number ?? "",
    emailAddress: officer.email_address ?? "",
    facebookLink: officer.facebook_link ?? "",
  }
}

/** Returns true if the proponent has at minimum the required name fields filled. */
function isProponentComplete(p: Proponent): boolean {
  return p.firstName.trim().length > 0 && p.lastName.trim().length > 0
}

export function ProponentsSection({
  proponents,
  departmentValues = {},
  onUpdate,
  onRemove,
  onAdd,
  onAddFromOfficer,
}: {
  proponents: Proponent[]
  departmentValues?: Record<string, string>
  onUpdate: (id: string, field: keyof Proponent, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  /** Add a proponent pre-filled from a saved officer. */
  onAddFromOfficer?: (proponent: Proponent) => void
}) {
  const canRemove = proponents.length > 0
  const atMax = proponents.length >= MAX_PROPONENTS
  // Every proponent belongs to the applying organization, so its name is
  // auto-filled rather than typed.
  const currentOrgQuery = useCurrentOrganizationQuery()
  const organizationName = currentOrgQuery.data?.name || ""
  const configuredDepartment = currentOrgQuery.data?.department?.trim() || ""
  const organizationDepartment =
    getDepartmentItem(configuredDepartment)?.code || ""
  const skipDean = currentOrgQuery.data?.skip_dean === true
  // Skipping the dean leaves no dean department to lock.
  const choosesDepartment = skipDean && organizationDepartment === ""
  const departmentIsMissing =
    !currentOrgQuery.isPending &&
    !choosesDepartment &&
    organizationDepartment === ""

  // ── Officer picker state ──
  const officersQuery = useOfficersQuery()
  const officers = officersQuery.data ?? []
  const [selectedOfficerId, setSelectedOfficerId] = useState("")

  // Roles available for the position dropdown: configured roles + officers' positions
  const orgRoles = Array.from(
    new Set([
      ...(currentOrgQuery.data?.position_roles ?? []),
      ...officers.map((o) => (o.position_of_applicant || "").trim()),
    ])
  ).filter(Boolean)

  // Deduplicate officers already added to this proposal by student number
  const addedStudentNumbers = new Set(
    proponents
      .map((p) => (p.studentNumber || "").trim().toLowerCase())
      .filter(Boolean)
  )
  const availableOfficers = officers.filter(
    (o) =>
      !addedStudentNumbers.has((o.student_number || "").trim().toLowerCase())
  )
  const selectedOfficer = officers.find((o) => o.officer_id === selectedOfficerId)

  // ── "Add Another" validation ──
  // The last proponent must have first + last name before another can be added.
  const lastProponent = proponents[proponents.length - 1]
  const lastProponentComplete = lastProponent == null || isProponentComplete(lastProponent)

  // Error shown below "Add Another Proponent" when user clicks but last is incomplete.
  const [showAddError, setShowAddError] = useState(false)
  const hasAddError = showAddError && !lastProponentComplete

  function handleAddAnother() {
    if (!lastProponentComplete) {
      setShowAddError(true)
      return
    }
    setShowAddError(false)
    onAdd()
  }

  function handleAddManual() {
    if (proponents.length > 0 && !lastProponentComplete) {
      setShowAddError(true)
      return
    }
    setShowAddError(false)
    onAdd()
  }

  function handleAddOfficer() {
    if (!selectedOfficerId || !onAddFromOfficer) return
    if (proponents.length > 0 && !lastProponentComplete) {
      setShowAddError(true)
      return
    }
    const officer = officers.find((o) => o.officer_id === selectedOfficerId)
    if (!officer) return
    const id = crypto.randomUUID()
    const proponent = officerToProponent(officer, id)
    // Always use the organization's name and department — never the officer's personal values
    proponent.orgOrCourseSection = organizationName
    proponent.department = organizationDepartment || ""
    setShowAddError(false)
    onAddFromOfficer(proponent)
    setSelectedOfficerId("")
  }

  return (
    <div className={layout.stack}>
      {currentOrgQuery.isPending ? (
        <Alert>
          <Loader2 className="animate-spin" />
          <AlertTitle>Resolving organization department</AlertTitle>
          <AlertDescription>
            Loading the department assigned to your organization.
          </AlertDescription>
        </Alert>
      ) : null}

      {choosesDepartment ? (
        <Alert>
          <AlertTitle>Choose each proponent&apos;s department</AlertTitle>
          <AlertDescription>
            This organization skips the dean, so the department is selected
            on this form.
          </AlertDescription>
        </Alert>
      ) : null}

      {departmentIsMissing ? (
        <Alert variant="error">
          <CircleAlertIcon />
          <AlertTitle>Organization department cannot be resolved</AlertTitle>
          <AlertDescription>
            {configuredDepartment
              ? `The assigned dean's department ("${configuredDepartment}") does not match a supported department.`
              : "A dean with a department must be assigned to your organization."}{" "}
            Please contact an administrator before submitting.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* ── Unified Left/Right Container ── */}
      <Card className={cn(layout.card, "overflow-hidden")}>
        {/*
          CSS grid with items-stretch: row height = tallest cell.
          Left column: h-full so its border-r extends the full row height.
          Right column: fixed max-h sized to ~1 proponent card; overflow-y-auto
          means no scrollbar with 1 proponent (content fits) and a scrollbar
          with 2+ proponents (content overflows the locked height).
        */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-12 min-h-[580px]">

          {/* ── Left Column: Roster Controls ── */}
          <div className="flex h-full flex-col justify-center gap-5 p-5 sm:p-6 lg:col-span-5 lg:border-r lg:border-neutral-100">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 border border-red-100">
                <UsersIcon className="size-4.5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-900">
                  Organization Officer Roster &amp; Proponents
                </h4>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Select officers from your organization roster or add proponents manually.
                </p>
              </div>
            </div>

            {/* Officer Picker Controls */}
            <div className="flex flex-col gap-2.5 border-t border-neutral-100 pt-4">
              {officers.length === 0 && (
                <p className="text-xs text-neutral-500">
                  No saved officers found in roster.
                </p>
              )}

              <Select
                value={selectedOfficerId}
                onValueChange={(val) => {
                  if (typeof val === "string") setSelectedOfficerId(val)
                }}
                disabled={atMax || officers.length === 0 || availableOfficers.length === 0}
              >
                <SelectTrigger
                  aria-label="Select saved officer"
                  className="h-9 w-full border-neutral-300 bg-white text-xs text-neutral-800"
                >
                  <SelectValue
                    placeholder={
                      officers.length === 0
                        ? "No saved officers in roster"
                        : atMax
                        ? "Maximum proponents reached"
                        : availableOfficers.length === 0
                        ? "All saved officers already added"
                        : "Choose an officer to add…"
                    }
                  >
                    {selectedOfficer
                      ? `${officerFullName(selectedOfficer)} (${selectedOfficer.position_of_applicant || "Officer"})`
                      : officers.length === 0
                      ? "No saved officers in roster"
                      : availableOfficers.length === 0
                      ? "All saved officers already added"
                      : "Choose an officer to add…"}
                  </SelectValue>
                </SelectTrigger>
                {officers.length > 0 && (
                  <SelectContent
                    alignItemWithTrigger={false}
                    side="bottom"
                    sideOffset={4}
                    className="z-50 max-h-60 rounded-xl bg-white p-1 text-xs text-neutral-900 shadow-md"
                    style={SELECT_CONTENT_STYLE}
                  >
                    {availableOfficers.map((officer) => (
                      <SelectItem
                        key={officer.officer_id}
                        value={officer.officer_id}
                        className={SELECT_ITEM_CLASS}
                      >
                        {[officer.first_name, officer.last_name]
                          .filter(Boolean)
                          .join(" ")}{" "}
                        <span className="font-normal text-neutral-500">
                          ({officer.position_of_applicant || "Officer"})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                )}
              </Select>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!selectedOfficerId || atMax || officers.length === 0}
                onClick={handleAddOfficer}
                className="w-full gap-1.5"
              >
                <PlusIcon className="size-3.5" />
                <span>Add as Proponent</span>
              </Button>

              {!atMax && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddManual}
                  className="w-full gap-1.5"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Add Proponent Manually</span>
                </Button>
              )}
            </div>
          </div>

          {/* ── Right Column: Proponents List ── */}
          <div className="flex flex-col border-t border-neutral-100 lg:col-span-7 lg:border-t-0">
            {proponents.length === 0 ? (
              <div className="flex h-full flex-1 items-center justify-center p-6 min-h-[360px] lg:min-h-full">
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No proponents added yet</EmptyTitle>
                    <EmptyDescription>
                      Select an officer from the left or click &ldquo;Add Proponent Manually&rdquo; to get started.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <div
                className={cn(
                  "flex flex-col divide-y divide-neutral-100",
                  proponents.length > 1
                    ? "max-h-[620px] overflow-y-auto"
                    : "overflow-hidden"
                )}
              >
                {proponents.map((proponent, index) => (
                  <div key={proponent.id} className="p-4 sm:p-5">
                    <ProponentCard
                      proponent={proponent}
                      index={index}
                      canRemove={canRemove}
                      departmentEditable={choosesDepartment}
                      departmentValue={
                        choosesDepartment
                          ? departmentValues[proponent.id] || proponent.department
                          : organizationDepartment
                      }
                      organizationName={organizationName}
                      orgRoles={orgRoles}
                      onUpdate={onUpdate}
                      onRemove={onRemove}
                    />
                  </div>
                ))}

                {/* Add Another / max notice */}
                {atMax ? (
                  <p className="px-5 py-3 text-center text-xs text-neutral-500" role="note">
                    Maximum of {MAX_PROPONENTS} proponents reached.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 p-3">
                    <button
                      type="button"
                      onClick={handleAddAnother}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3 text-sm font-medium text-neutral-700 transition-all hover:border-red-600 hover:bg-red-50/30 hover:text-red-700"
                    >
                      <PlusIcon className="h-4 w-4 text-neutral-600" />
                      <span>Add Another Proponent</span>
                    </button>
                    {hasAddError && (
                      <p className="text-center text-xs font-medium text-red-600">
                        Fill in the First Name and Last Name for Proponent {proponents.length} before adding another.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </Card>
    </div>
  )
}
