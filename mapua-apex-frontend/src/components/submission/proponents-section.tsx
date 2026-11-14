import { useState } from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { ProponentCard } from "@/components/submission/proponent-card"
import {
  MAX_PROPONENTS,
  SELECT_CONTENT_STYLE,
  SELECT_ITEM_CLASS,
} from "@/components/submission/constants"
import type { Proponent } from "@/components/submission/types"
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
import {
  useCurrentOrganizationQuery,
  useOfficersQuery,
} from "@/hooks/use-submissions"
import { layout } from "@/config"
import { cn } from "@/lib/utils"
import type { ApiOfficer } from "@/lib/dynamodb-adapters"

function officerFullName(officer: ApiOfficer): string {
  return [
    officer.first_name,
    officer.middle_name,
    officer.last_name,
    officer.suffix,
  ]
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
    campus: "",
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
  const selectedOfficer = officers.find(
    (o) => o.officer_id === selectedOfficerId
  )

  // ── "Add Another" validation ──
  // The last proponent must have first + last name before another can be added.
  const lastProponent = proponents[proponents.length - 1]
  const lastProponentComplete =
    lastProponent == null || isProponentComplete(lastProponent)

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
    // Always use the organization's name; campus and department are chosen
    // per proponent on the card (S-7).
    proponent.orgOrCourseSection = organizationName
    setShowAddError(false)
    onAddFromOfficer(proponent)
    setSelectedOfficerId("")
  }

  return (
    <div className={layout.stack}>
      {/* ── Unified Top/Bottom Container ── */}
      <Card className={cn(layout.card, "overflow-hidden")}>
        {/*
          Vertical stack: roster controls sit above the proponents list.
          The list is capped at half the viewport height and scrolls
          internally, so the adder controls stay visible while scrolling.
        */}
        <div className="flex flex-col">
          {/* ── Top: Roster Controls ── */}
          <div className="flex flex-col gap-5 border-b border-neutral-100 p-5 sm:p-6">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-700">
                <UsersIcon className="size-4.5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-900">
                  Organization Officer Roster &amp; Proponents
                </h4>
                <p className="text-xs leading-relaxed text-neutral-600">
                  Select officers from your organization roster or add
                  proponents manually.
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

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Select
                  value={selectedOfficerId}
                  onValueChange={(val) => {
                    if (typeof val === "string") setSelectedOfficerId(val)
                  }}
                  disabled={
                    atMax ||
                    officers.length === 0 ||
                    availableOfficers.length === 0
                  }
                >
                  <SelectTrigger
                    aria-label="Select saved officer"
                    className="h-9 w-full border-neutral-300 bg-white text-xs text-neutral-800 sm:min-w-0 sm:flex-1"
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
                  disabled={
                    !selectedOfficerId || atMax || officers.length === 0
                  }
                  onClick={handleAddOfficer}
                  className="w-full gap-1.5 sm:w-auto sm:shrink-0"
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
                    className="w-full gap-1.5 sm:w-auto sm:shrink-0"
                  >
                    <PlusIcon className="size-3.5" />
                    <span>Add Proponent Manually</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom: Proponents List ── */}
          <div className="flex flex-col">
            {proponents.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center p-6">
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No proponents added yet</EmptyTitle>
                    <EmptyDescription>
                      Select an officer from above or click &ldquo;Add Proponent
                      Manually&rdquo; to get started.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              <div className="flex max-h-[50dvh] [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] flex-col divide-y divide-neutral-100 overflow-y-auto">
                {proponents.map((proponent, index) => (
                  <div key={proponent.id} className="p-4 sm:p-5">
                    <ProponentCard
                      proponent={proponent}
                      index={index}
                      canRemove={canRemove}
                      departmentValue={
                        departmentValues[proponent.id] || proponent.department
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
                  <p
                    className="px-5 py-3 text-center text-xs text-neutral-500"
                    role="note"
                  >
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
                        Fill in the First Name and Last Name for Proponent{" "}
                        {proponents.length} before adding another.
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
