import { useState, type FormEvent } from "react"
import {
  Building2Icon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"

import { FormPageHeader } from "@/components/forms/form-page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toastManager } from "@/components/ui/toast"
import { layout, modal } from "@/config"
import {
  useCurrentOrganizationQuery,
  useOfficersQuery,
  useCreateOfficerMutation,
  useUpdateOfficerMutation,
  useDeleteOfficerMutation,
} from "@/hooks/use-submissions"
import { mutationErrorMessage } from "@/hooks/use-admin"
import { checkGibberishFields } from "@/hooks/use-gibberish-check"
import {
  MAX_STUDENT_YEAR,
  MIN_STUDENT_YEAR,
  MOBILE_NUMBER_LENGTH,
  SELECT_ITEM_CLASS,
  STUDENT_NUMBER_LENGTH,
  SUFFIX_OPTIONS,
  YEAR_LEVEL_OPTIONS,
  getDepartmentPrograms,
  sanitizeMobileNumber,
  stripDigits,
} from "@/components/submission/constants"
import {
  blockNonIntegerKeys,
  sanitizeIntegerInput,
} from "@/lib/numeric-input"
import {
  LETTERS_ONLY_PATTERN,
  isValidFacebookUrl,
} from "@/components/submission/validate-saaf-step"
import {
  validateEmailDomain,
  validateEmailLive,
} from "@/lib/auth-validation"
import { cn } from "@/lib/utils"
import type { ApiOfficer, CreateOfficerPayload } from "@/lib/dynamodb-adapters"

/** Prevents typing 0-9 in letters-only fields */
function blockDigitKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault()
  }
}

function parseProgramAndYear(val: string): { program: string; year: string } {
  const trimmed = (val || "").trim()
  if (!trimmed) return { program: "", year: "" }

  const match = trimmed.match(
    /^(.*?)\s*-\s*(1st Year|2nd Year|3rd Year|4th Year|5th Year|11|12)$/i
  )
  if (match) {
    const matchedYear = match[2].trim()
    const canonicalYear =
      (YEAR_LEVEL_OPTIONS as readonly string[]).find(
        (y) => y.toLowerCase() === matchedYear.toLowerCase()
      ) ?? matchedYear
    return { program: match[1].trim(), year: canonicalYear }
  }

  const foundYear = (YEAR_LEVEL_OPTIONS as readonly string[]).find(
    (y) => y.toLowerCase() === trimmed.toLowerCase()
  )
  if (foundYear) {
    return { program: "", year: foundYear }
  }

  return { program: trimmed, year: "" }
}

const COMMON_ROLE_SUGGESTIONS = [
  "President",
  "Vice President",
  "Secretary",
  "Treasurer",
  "Auditor",
  "Public Relations Officer",
  "Project Lead",
  "Committee Head",
]

interface OfficerFormData {
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  student_number: string
  program: string
  year: string
  department: string
  position_of_applicant: string
  contact_number: string
  email_address: string
  facebook_link: string
}

const EMPTY_OFFICER_FORM: OfficerFormData = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  student_number: "",
  program: "",
  year: "",
  department: "",
  position_of_applicant: "",
  contact_number: "",
  email_address: "",
  facebook_link: "",
}

function officerToFormData(o: ApiOfficer): OfficerFormData {
  const { program, year } = parseProgramAndYear(o.program_and_year || "")
  return {
    first_name: o.first_name ?? "",
    middle_name: o.middle_name ?? "",
    last_name: o.last_name ?? "",
    suffix: o.suffix ?? "",
    student_number: o.student_number ?? "",
    program,
    year,
    department: o.department ?? "",
    position_of_applicant: o.position_of_applicant ?? "",
    contact_number: o.contact_number ?? "",
    email_address: o.email_address ?? "",
    facebook_link: o.facebook_link ?? "",
  }
}

function officerFullName(o: {
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
}): string {
  return [o.first_name, o.middle_name, o.last_name, o.suffix]
    .filter(Boolean)
    .join(" ")
}

export function StudentOrganizationPage() {
  const orgQuery = useCurrentOrganizationQuery()
  const officersQuery = useOfficersQuery()
  const createMutation = useCreateOfficerMutation()
  const updateMutation = useUpdateOfficerMutation()
  const deleteMutation = useDeleteOfficerMutation()

  const org = orgQuery.data
  const officers = officersQuery.data ?? []

  // Search & filter
  const [search, setSearch] = useState("")
  const filteredOfficers = officers.filter((officer) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    const name = officerFullName(officer).toLowerCase()
    const pos = (officer.position_of_applicant || "").toLowerCase()
    const id = (officer.student_number || "").toLowerCase()
    const prog = (officer.program_and_year || "").toLowerCase()
    return (
      name.includes(term) ||
      pos.includes(term) ||
      id.includes(term) ||
      prog.includes(term)
    )
  })

  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [editingOfficer, setEditingOfficer] = useState<ApiOfficer | null>(null)
  const [formData, setFormData] = useState<OfficerFormData>(EMPTY_OFFICER_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof OfficerFormData, string>>>({})

  // Delete dialog state
  const [officerToDelete, setOfficerToDelete] = useState<ApiOfficer | null>(null)

  function openAddDialog(presetPosition?: string) {
    setEditingOfficer(null)
    setFormData({
      ...EMPTY_OFFICER_FORM,
      position_of_applicant: presetPosition || "",
      department: org?.department || "",
    })
    setFormErrors({})
    setIsFormDialogOpen(true)
  }

  function openEditDialog(officer: ApiOfficer) {
    setEditingOfficer(officer)
    setFormData(officerToFormData(officer))
    setFormErrors({})
    setIsFormDialogOpen(true)
  }

  function handleFieldChange(field: keyof OfficerFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function validateForm(): Partial<Record<keyof OfficerFormData, string>> {
    const errors: Partial<Record<keyof OfficerFormData, string>> = {}

    // 1. First Name
    const firstName = formData.first_name.trim()
    if (!firstName) {
      errors.first_name = "First name is required."
    } else if (!LETTERS_ONLY_PATTERN.test(firstName)) {
      errors.first_name = "First name must only contain letters."
    }

    // 2. Middle Name (optional)
    const middleName = formData.middle_name.trim()
    if (middleName && !LETTERS_ONLY_PATTERN.test(middleName)) {
      errors.middle_name = "Middle name must only contain letters."
    }

    // 3. Last Name
    const lastName = formData.last_name.trim()
    if (!lastName) {
      errors.last_name = "Last name is required."
    } else if (!LETTERS_ONLY_PATTERN.test(lastName)) {
      errors.last_name = "Last name must only contain letters."
    }

    // 4. Duplicate Full Name
    const normFirst = firstName.toLowerCase()
    const normMiddle = middleName.toLowerCase()
    const normLast = lastName.toLowerCase()
    const duplicateFullName = officers.some((o) => {
      if (editingOfficer && o.officer_id === editingOfficer.officer_id) return false
      return (
        (o.first_name || "").trim().toLowerCase() === normFirst &&
        (o.middle_name || "").trim().toLowerCase() === normMiddle &&
        (o.last_name || "").trim().toLowerCase() === normLast
      )
    })
    if (duplicateFullName && !errors.first_name) {
      errors.first_name = "An officer with this exact full name already exists in your roster."
    }

    // 5. Student Number
    const sNum = formData.student_number.trim()
    if (!sNum) {
      errors.student_number = "Student number is required."
    } else if (!/^\d+$/.test(sNum)) {
      errors.student_number = "Student number must be numbers only."
    } else if (sNum.length !== STUDENT_NUMBER_LENGTH) {
      errors.student_number = `Student number must be ${STUDENT_NUMBER_LENGTH} digits.`
    } else {
      const year = Number(sNum.slice(0, 4))
      if (year < MIN_STUDENT_YEAR || year > MAX_STUDENT_YEAR) {
        errors.student_number = `Student number must start with a year between ${MIN_STUDENT_YEAR} and ${MAX_STUDENT_YEAR}.`
      }
    }

    // 6. Duplicate Student Number
    const duplicateSNum = officers.some((o) => {
      if (editingOfficer && o.officer_id === editingOfficer.officer_id) return false
      return (o.student_number || "").trim().toLowerCase() === sNum.toLowerCase()
    })
    if (duplicateSNum && !errors.student_number) {
      errors.student_number = "This student number is already registered in your roster."
    }

    // 7. Program & Year
    const program = formData.program.trim()
    const year = formData.year.trim()
    if (!program) {
      errors.program = "Program is required."
    }
    if (!year) {
      errors.year = "Year level is required."
    }

    // 8. Position
    const pos = formData.position_of_applicant.trim()
    if (!pos) {
      errors.position_of_applicant = "Position title is required."
    }

    // 9. Contact / Mobile Number
    const contact = formData.contact_number.trim()
    if (!contact) {
      errors.contact_number = "Mobile number is required."
    } else if (!contact.startsWith("09")) {
      errors.contact_number = "Mobile number must start with 09."
    } else if (contact.length !== MOBILE_NUMBER_LENGTH) {
      errors.contact_number = `Mobile number must be ${MOBILE_NUMBER_LENGTH} digits.`
    } else if (!/^09\d{9}$/.test(contact)) {
      errors.contact_number = "Must be an 11-digit mobile number starting with 09."
    }

    // 10. Email Address
    const email = formData.email_address.trim()
    if (!email) {
      errors.email_address = "Email address is required."
    } else {
      const emailError = validateEmailLive(email) ?? validateEmailDomain(email)
      if (emailError) {
        errors.email_address = emailError
      }
    }

    // 11. Duplicate Email Address
    const duplicateEmail = officers.some((o) => {
      if (editingOfficer && o.officer_id === editingOfficer.officer_id) return false
      return (o.email_address || "").trim().toLowerCase() === email.toLowerCase()
    })
    if (duplicateEmail && !errors.email_address) {
      errors.email_address = "This email address is already registered in your roster."
    }

    // 12. Facebook Link
    let fb = formData.facebook_link.trim()
    if (!fb) {
      errors.facebook_link = "Facebook link is required."
    } else {
      if (!/^https?:\/\//i.test(fb)) {
        fb = `https://${fb}`
      }
      if (!isValidFacebookUrl(fb)) {
        errors.facebook_link = "Facebook link must start with https://facebook.com/ (e.g. https://facebook.com/username)"
      }
    }

    return errors
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      return
    }

    // Pre-submit Gibberish Detection
    const flagged = await checkGibberishFields([
      { label: "First Name", value: formData.first_name.trim() },
      { label: "Middle Name", value: formData.middle_name.trim() },
      { label: "Last Name", value: formData.last_name.trim() },
      { label: "Position Title", value: formData.position_of_applicant.trim() },
    ])
    if (flagged.length > 0) {
      toastManager.add({
        title: "Invalid text detected",
        description: `These fields appear to contain gibberish: ${flagged.join(", ")}. Please revise them.`,
        type: "error",
      })
      return
    }

    let fbLink = formData.facebook_link.trim()
    if (fbLink && !/^https?:\/\//i.test(fbLink)) {
      fbLink = `https://${fbLink}`
    }

    const payload: CreateOfficerPayload = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      student_number: formData.student_number.trim(),
      program_and_year: `${formData.program.trim()} - ${formData.year.trim()}`,
      position_of_applicant: formData.position_of_applicant.trim(),
      contact_number: formData.contact_number.trim(),
      email_address: formData.email_address.trim(),
      facebook_link: fbLink,
    }
    if (formData.middle_name.trim()) payload.middle_name = formData.middle_name.trim()
    if (formData.suffix.trim() && formData.suffix.trim().toLowerCase() !== "none") {
      payload.suffix = formData.suffix.trim()
    }
    const orgDepartment = org?.department?.trim() || formData.department?.trim() || ""
    if (orgDepartment) payload.department = orgDepartment

    try {
      if (editingOfficer) {
        await updateMutation.mutateAsync({
          officerId: editingOfficer.officer_id,
          payload,
        })
        toastManager.add({
          title: "Officer updated",
          description: `Updated details for ${payload.first_name} ${payload.last_name}.`,
          type: "success",
        })
      } else {
        await createMutation.mutateAsync(payload)
        toastManager.add({
          title: "Officer added",
          description: `${payload.first_name} ${payload.last_name} has been added to the roster.`,
          type: "success",
        })
      }
      setIsFormDialogOpen(false)
    } catch (error) {
      console.error("Failed to save officer:", error)
      toastManager.add({
        title: editingOfficer ? "Could not update officer" : "Could not add officer",
        description: mutationErrorMessage(error, "Please verify all fields and try again."),
        type: "error",
      })
    }
  }

  async function handleConfirmDelete() {
    if (!officerToDelete) return
    const name = officerFullName(officerToDelete)
    try {
      await deleteMutation.mutateAsync(officerToDelete.officer_id)
      toastManager.add({
        title: "Officer removed",
        description: `${name} has been removed from your officer roster.`,
        type: "success",
      })
      setOfficerToDelete(null)
    } catch (error) {
      toastManager.add({
        title: "Could not remove officer",
        description: mutationErrorMessage(error, "Failed to delete officer from roster."),
        type: "error",
      })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className={cn(layout.page, layout.stack)}>
      <div className={cn(layout.container, layout.stack)}>
        <FormPageHeader
          title="Organization Profile &amp; Officer Roster"
          subtitle="View your organization's setup and manage your officer roster for fast proponent auto-fill when filing project proposals."
        />

        {orgQuery.isPending ? (
          <Alert>
            <Skeleton className="size-4 rounded-full" />
            <AlertTitle>Loading organization details</AlertTitle>
            <AlertDescription>
              Fetching organization profile and active roster…
            </AlertDescription>
          </Alert>
        ) : null}

        {orgQuery.isError ? (
          <Alert variant="error">
            <AlertTitle>Could not load organization</AlertTitle>
            <AlertDescription>
              Failed to load your organization. Please refresh the page or try
              again later.
            </AlertDescription>
          </Alert>
        ) : null}

        {org ? (
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]",
              layout.gap
            )}
          >
            {/* ── Left Column: Organization Summary & Quick Roles ── */}
            <div className="space-y-6">
              <Card className={layout.card}>
                <CardHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 text-red-700">
                      <Building2Icon className="size-5" />
                    </div>
                    <div>
                      <CardTitle>{org.name}</CardTitle>
                      <CardDescription>Organization Overview</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardPanel className="space-y-4 text-sm">
                  <div>
                    <span className="font-medium text-neutral-500">
                      Assigned Department:
                    </span>
                    <p className="font-semibold text-neutral-800">
                      {org.department
                        ? org.department
                        : org.skip_dean
                        ? "Selected per proposal (skips dean)"
                        : "Not assigned"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">
                      Dean Review:
                    </span>
                    <p className="text-neutral-800">
                      {org.skip_dean ? "Skipped" : "Included in approval chain"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">
                      Post-evaluation Reports:
                    </span>
                    <p className="text-neutral-800">
                      {org.skip_post_eval ? "Exempt / Skipped" : "Required after events"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-500">
                      Officer Roster Size:
                    </span>
                    <p className="text-neutral-800">
                      <span className="font-bold text-red-700">
                        {officers.length}
                      </span>{" "}
                      saved officer{officers.length === 1 ? "" : "s"} (max 50)
                    </p>
                  </div>
                </CardPanel>
              </Card>

              {/* Suggestions Panel */}
              <Card className={layout.card}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="size-4 text-red-700" />
                    <CardTitle className="text-sm font-semibold">
                      Common Officer Positions
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Click a title to quickly register an officer with that position:
                  </CardDescription>
                </CardHeader>
                <CardPanel className="flex flex-wrap gap-1.5 pt-0">
                  {COMMON_ROLE_SUGGESTIONS.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => openAddDialog(role)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <PlusIcon className="size-3" />
                      {role}
                    </button>
                  ))}
                </CardPanel>
              </Card>
            </div>

            {/* ── Right Column: Officer Roster Card ── */}
            <div className="min-w-0">
              <Card className={cn(layout.card, "min-w-0 overflow-hidden")}>
                <CardHeader>
                  <div>
                    <CardTitle>Officer Roster</CardTitle>
                    <CardDescription>
                      {officersQuery.isPending
                        ? "Loading roster…"
                        : `${officers.length} officer${
                            officers.length === 1 ? "" : "s"
                          } registered`}
                    </CardDescription>
                  </div>
                  <CardAction className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Input
                      aria-label="Search officers"
                      className="w-full sm:w-56"
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search officers…"
                      type="search"
                      value={search}
                    />
                    {officers.length < 50 && (
                      <Button
                        type="button"
                        onClick={() => openAddDialog()}
                        className="shrink-0 gap-1.5"
                      >
                        <PlusIcon className="size-4" />
                        Add Officer
                      </Button>
                    )}
                  </CardAction>
                </CardHeader>

                <CardPanel className="p-0">
                  {officersQuery.isPending ? (
                    <div className="space-y-2 px-6 pb-6 pt-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : officers.length === 0 ? (
                    <Empty className="py-12">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <UsersIcon aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>No officers saved yet</EmptyTitle>
                        <EmptyDescription>
                          Add your organization&apos;s officers here once. You&apos;ll
                          be able to select them directly when filing proposals without
                          retyping their details every time.
                        </EmptyDescription>
                        <Button
                          type="button"
                          onClick={() => openAddDialog()}
                          className="mt-4 gap-1.5"
                        >
                          <PlusIcon className="size-4" />
                          Add your first officer
                        </Button>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="px-4 pb-4 sm:px-6 sm:pb-6 md:px-7 md:pb-7">
                      <Table className="w-full" containerClassName="overflow-x-hidden">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-0">Officer</TableHead>
                            <TableHead className="min-w-0">Position</TableHead>
                            <TableHead className="min-w-0">Student No.</TableHead>
                            <TableHead className="hidden 2xl:table-cell min-w-0">
                              Contact
                            </TableHead>
                            <TableHead className="w-20 shrink-0 text-right">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOfficers.length === 0 ? (
                            <TableRow>
                              <TableCell
                                className="py-8 text-center text-xs text-neutral-500"
                                colSpan={5}
                              >
                                No officers match &ldquo;{search}&rdquo;.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredOfficers.map((officer) => (
                              <TableRow key={officer.officer_id}>
                                <TableCell className="min-w-0 max-w-[200px]">
                                  <div
                                    className="font-semibold text-neutral-900 truncate"
                                    title={officerFullName(officer)}
                                  >
                                    {officerFullName(officer)}
                                  </div>
                                  <div
                                    className="text-xs text-neutral-500 truncate"
                                    title={officer.program_and_year}
                                  >
                                    {officer.program_and_year}
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-0 max-w-[150px]">
                                  <Badge
                                    variant="outline"
                                    className="max-w-full truncate text-xs font-medium"
                                    title={officer.position_of_applicant || "Officer"}
                                  >
                                    {officer.position_of_applicant || "Officer"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs text-neutral-600 whitespace-nowrap">
                                  {officer.student_number}
                                </TableCell>
                                <TableCell className="hidden text-xs text-neutral-600 2xl:table-cell max-w-[180px] min-w-0">
                                  <div>{officer.contact_number}</div>
                                  <div
                                    className="truncate text-neutral-400"
                                    title={officer.email_address}
                                  >
                                    {officer.email_address}
                                  </div>
                                </TableCell>
                                <TableCell className="w-20 shrink-0 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditDialog(officer)}
                                      title="Edit officer"
                                      className="size-7 p-0"
                                    >
                                      <PencilIcon className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setOfficerToDelete(officer)}
                                      title="Remove officer"
                                      className="size-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                      <Trash2Icon className="size-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardPanel>
              </Card>
            </div>
          </div>
        ) : null}

        {/* ── Add / Edit Officer Dialog ── */}
        <Dialog
          open={isFormDialogOpen}
          onOpenChange={(open) => {
            if (!open) setIsFormDialogOpen(false)
          }}
        >
          <DialogPopup className={modal.dialogLg}>
            <DialogHeader>
              <DialogTitle>
                {editingOfficer ? "Edit Officer" : "Add Officer"}
              </DialogTitle>
              <DialogDescription>
                Officer details are saved to your organization roster and used to
                pre-fill proponent cards in proposal filings.
              </DialogDescription>
            </DialogHeader>

            <Form className="contents" onSubmit={handleFormSubmit}>
              <DialogPanel className="space-y-6 p-6 pt-2 pb-6">
                {/* Section 1: Personal Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Personal Information
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="dlg-first-name">
                        First Name <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Input
                        id="dlg-first-name"
                        placeholder="e.g. Alice"
                        value={formData.first_name}
                        maxLength={30}
                        aria-invalid={Boolean(formErrors.first_name)}
                        className={formErrors.first_name ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                        onKeyDown={blockDigitKeys}
                        onChange={(e) =>
                          handleFieldChange("first_name", stripDigits(e.target.value))
                        }
                      />
                      {formErrors.first_name && (
                        <p className="text-xs font-medium text-red-600 mt-1">{formErrors.first_name}</p>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="dlg-last-name">
                        Last Name <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Input
                        id="dlg-last-name"
                        placeholder="e.g. Reyes"
                        value={formData.last_name}
                        maxLength={30}
                        aria-invalid={Boolean(formErrors.last_name)}
                        className={formErrors.last_name ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                        onKeyDown={blockDigitKeys}
                        onChange={(e) =>
                          handleFieldChange("last_name", stripDigits(e.target.value))
                        }
                      />
                      {formErrors.last_name && (
                        <p className="text-xs font-medium text-red-600 mt-1">{formErrors.last_name}</p>
                      )}
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="dlg-middle-name">Middle Name</FieldLabel>
                      <Input
                        id="dlg-middle-name"
                        placeholder="(optional)"
                        value={formData.middle_name}
                        maxLength={30}
                        aria-invalid={Boolean(formErrors.middle_name)}
                        className={formErrors.middle_name ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                        onKeyDown={blockDigitKeys}
                        onChange={(e) =>
                          handleFieldChange("middle_name", stripDigits(e.target.value))
                        }
                      />
                      {formErrors.middle_name && (
                        <p className="text-xs font-medium text-red-600 mt-1">{formErrors.middle_name}</p>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="dlg-suffix">Suffix</FieldLabel>
                      <Select
                        value={
                          SUFFIX_OPTIONS.find(
                            (opt) =>
                              opt.value.toLowerCase() ===
                              (formData.suffix || "").toLowerCase()
                          )?.value ?? (formData.suffix || "none")
                        }
                        onValueChange={(val) => {
                          if (typeof val === "string") {
                            handleFieldChange("suffix", val === "none" ? "" : val)
                          }
                        }}
                      >
                        <SelectTrigger id="dlg-suffix">
                          <SelectValue placeholder="None">
                            {formData.suffix || "None"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="z-50 max-h-60 rounded-xl bg-white p-1 text-xs text-neutral-900 shadow-md">
                          {SUFFIX_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className={SELECT_ITEM_CLASS}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>

                {/* Section 2: Academic & Organization Role */}
                <div className="space-y-3 border-t border-neutral-100 pt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Academic &amp; Organization Role
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="dlg-student-number">
                        Student Number <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Input
                        id="dlg-student-number"
                        placeholder="202XXXXXXX"
                        type="text"
                        inputMode="numeric"
                        minLength={STUDENT_NUMBER_LENGTH}
                        maxLength={STUDENT_NUMBER_LENGTH}
                        value={formData.student_number}
                        aria-invalid={Boolean(formErrors.student_number)}
                        className={formErrors.student_number ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) =>
                          handleFieldChange(
                            "student_number",
                            sanitizeIntegerInput(e.target.value).slice(
                              0,
                              STUDENT_NUMBER_LENGTH
                            )
                          )
                        }
                      />
                      {formErrors.student_number && (
                        <p className="text-xs font-medium text-red-600 mt-1">{formErrors.student_number}</p>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="dlg-department">
                        Department
                      </FieldLabel>
                      <Input
                        id="dlg-department"
                        value={org?.department || "Not assigned"}
                        readOnly
                        aria-readonly="true"
                        className="cursor-not-allowed bg-neutral-100/70 text-neutral-600"
                      />
                      <p className="mt-1 text-[11px] text-neutral-400">
                        Locked to your organization&apos;s assigned department.
                      </p>
                    </Field>
                  </div>

                  {/* Program & Year level selectors */}
                  {(() => {
                    const programOptions = getDepartmentPrograms(org?.department)

                    return (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="dlg-program">
                            Program <span className="text-red-500">*</span>
                          </FieldLabel>
                          {programOptions.length > 0 ? (
                            <Select
                              value={formData.program}
                              onValueChange={(val) => {
                                if (typeof val === "string") {
                                  handleFieldChange("program", val)
                                }
                              }}
                            >
                              <SelectTrigger
                                id="dlg-program"
                                aria-invalid={Boolean(formErrors.program)}
                                className={cn(formErrors.program && "!border-red-500 focus-visible:!ring-red-500/20")}
                              >
                                <SelectValue placeholder="Select Program">
                                  {formData.program || "Select Program"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="z-50 max-h-60 rounded-xl bg-white p-1 text-xs text-neutral-900 shadow-md">
                                {programOptions.map((prog) => (
                                  <SelectItem
                                    key={prog.code}
                                    value={prog.code}
                                    className={SELECT_ITEM_CLASS}
                                  >
                                    {prog.name === prog.code
                                      ? prog.code
                                      : `${prog.name} (${prog.code})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id="dlg-program"
                              placeholder="e.g. BSCS"
                              value={formData.program}
                              maxLength={80}
                              aria-invalid={Boolean(formErrors.program)}
                              className={formErrors.program ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                              onChange={(e) =>
                                handleFieldChange("program", e.target.value)
                              }
                            />
                          )}
                          {formErrors.program && (
                            <p className="text-xs font-medium text-red-600 mt-1">{formErrors.program}</p>
                          )}
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="dlg-year-level">
                            Year Level <span className="text-red-500">*</span>
                          </FieldLabel>
                          <Select
                            value={formData.year}
                            onValueChange={(val) => {
                              if (typeof val === "string") {
                                handleFieldChange("year", val)
                              }
                            }}
                          >
                            <SelectTrigger
                              id="dlg-year-level"
                              aria-invalid={Boolean(formErrors.year)}
                              className={cn(formErrors.year && "!border-red-500 focus-visible:!ring-red-500/20")}
                            >
                              <SelectValue placeholder="Select Year Level">
                                {formData.year || "Select Year Level"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="z-50 max-h-60 rounded-xl bg-white p-1 text-xs text-neutral-900 shadow-md">
                              {YEAR_LEVEL_OPTIONS.map((yr) => (
                                <SelectItem
                                  key={yr}
                                  value={yr}
                                  className={SELECT_ITEM_CLASS}
                                >
                                  {yr}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {formErrors.year && (
                            <p className="text-xs font-medium text-red-600 mt-1">{formErrors.year}</p>
                          )}
                        </Field>
                      </div>
                    )
                  })()}

                  <Field>
                    <FieldLabel htmlFor="dlg-position">
                      Position Title <span className="text-red-500">*</span>
                    </FieldLabel>
                    <Input
                      id="dlg-position"
                      placeholder="e.g. President, Vice President"
                      value={formData.position_of_applicant}
                      maxLength={80}
                      aria-invalid={Boolean(formErrors.position_of_applicant)}
                      className={formErrors.position_of_applicant ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                      onChange={(e) =>
                        handleFieldChange("position_of_applicant", e.target.value)
                      }
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COMMON_ROLE_SUGGESTIONS.slice(0, 5).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() =>
                            handleFieldChange("position_of_applicant", suggestion)
                          }
                          className="inline-flex cursor-pointer items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600 transition hover:border-red-400 hover:bg-red-50 hover:text-red-700"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    {formErrors.position_of_applicant && (
                      <p className="text-xs font-medium text-red-600 mt-1">{formErrors.position_of_applicant}</p>
                    )}
                  </Field>
                </div>

                {/* Section 3: Contact & Links */}
                <div className="space-y-3 border-t border-neutral-100 pt-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Contact &amp; Social Profile
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="dlg-contact">
                        Mobile Number <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Input
                        id="dlg-contact"
                        placeholder="09XXXXXXXXX"
                        type="text"
                        inputMode="numeric"
                        value={formData.contact_number}
                        maxLength={MOBILE_NUMBER_LENGTH}
                        aria-invalid={Boolean(formErrors.contact_number)}
                        className={formErrors.contact_number ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                        onKeyDown={blockNonIntegerKeys}
                        onChange={(e) =>
                          handleFieldChange(
                            "contact_number",
                            sanitizeMobileNumber(e.target.value).slice(
                              0,
                              MOBILE_NUMBER_LENGTH
                            )
                          )
                        }
                      />
                      {formErrors.contact_number && (
                        <p className="text-xs font-medium text-red-600 mt-1">{formErrors.contact_number}</p>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="dlg-email">
                        Email Address <span className="text-red-500">*</span>
                      </FieldLabel>
                      <Input
                        id="dlg-email"
                        type="email"
                        placeholder="student@mymail.mapua.edu.ph"
                        value={formData.email_address}
                        maxLength={150}
                        aria-invalid={Boolean(formErrors.email_address)}
                        className={formErrors.email_address ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                        onChange={(e) =>
                          handleFieldChange("email_address", e.target.value)
                        }
                      />
                      {formErrors.email_address && (
                        <p className="text-xs font-medium text-red-600 mt-1">{formErrors.email_address}</p>
                      )}
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="dlg-facebook">
                      Facebook Profile URL <span className="text-red-500">*</span>
                    </FieldLabel>
                    <Input
                      id="dlg-facebook"
                      type="url"
                      placeholder="https://facebook.com/username"
                      value={formData.facebook_link}
                      maxLength={300}
                      aria-invalid={Boolean(formErrors.facebook_link)}
                      className={formErrors.facebook_link ? "!border-red-500 focus-visible:!ring-red-500/20" : undefined}
                      onChange={(e) =>
                        handleFieldChange("facebook_link", e.target.value)
                      }
                    />
                    {formErrors.facebook_link && (
                      <p className="text-xs font-medium text-red-600 mt-1">{formErrors.facebook_link}</p>
                    )}
                  </Field>
                </div>
              </DialogPanel>

              <DialogFooter>
                <DialogClose render={<Button type="button" variant="ghost" />}>
                  Cancel
                </DialogClose>
                <Button loading={isSaving} type="submit">
                  {editingOfficer ? "Save changes" : "Add officer"}
                </Button>
              </DialogFooter>
            </Form>
          </DialogPopup>
        </Dialog>

        {/* ── Delete Confirmation Dialog ── */}
        <AlertDialog
          open={officerToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setOfficerToDelete(null)
          }}
        >
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this officer?</AlertDialogTitle>
              <AlertDialogDescription>
                {officerToDelete ? (
                  <>
                    <strong className="text-neutral-800">
                      {officerFullName(officerToDelete)}
                    </strong>{" "}
                    ({officerToDelete.position_of_applicant}) will be removed from
                    your officer roster. This will not change already-submitted
                    proposals.
                  </>
                ) : (
                  "This officer will be removed from your officer roster."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button type="button" variant="ghost" />}>
                Keep
              </AlertDialogClose>
              <Button
                loading={deleteMutation.isPending}
                onClick={handleConfirmDelete}
                type="button"
                variant="destructive"
              >
                Remove officer
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </div>
    </div>
  )
}
