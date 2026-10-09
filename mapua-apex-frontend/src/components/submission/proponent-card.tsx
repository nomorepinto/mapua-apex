import { memo } from "react"
import { Trash2Icon } from "lucide-react"

import { FieldWarning } from "@/components/forms/field-warning"
import {
  DEPARTMENT_GROUPS,
  FIELD_INPUT_CLASS,
  getDepartmentItem,
  getDepartmentPrograms,
  getProgramItem,
  getYearLevelOptions,
  MOBILE_NUMBER_LENGTH,
  sanitizeMobileNumber,
  SELECT_CONTENT_STYLE,
  SELECT_ITEM_CLASS,
  STUDENT_NUMBER_LENGTH,
  SUFFIX_OPTIONS,
  YEAR_LEVEL_OPTIONS,
} from "@/components/submission/constants"
import type { Proponent } from "@/components/submission/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

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

interface ProponentCardProps {
  proponent: Proponent
  index: number
  canRemove: boolean
  departmentValue: string
  /** Name of the applying organization; locks the "Name of Organization" field. */
  organizationName: string
  onUpdate: (id: string, field: keyof Proponent, value: string) => void
  onRemove: (id: string) => void
  onDepartmentChange: (id: string, value: string) => void
}

export const ProponentCard = memo(function ProponentCard({
  proponent,
  index,
  canRemove,
  departmentValue,
  organizationName,
  onUpdate,
  onRemove,
  onDepartmentChange,
}: ProponentCardProps) {
  const today = new Date().toISOString().split("T")[0]
  const submissionDate = proponent.dateOfSubmission || today
  // Derived from the applying organization, so it can never disagree with it.
  const organizationValue = organizationName || proponent.orgOrCourseSection

  const deptItem = getDepartmentItem(departmentValue)
  const selectedDeptCode = deptItem?.code ?? departmentValue

  const { program: parsedProgram, year: currentYear } = parseProgramAndYear(
    proponent.programAndYear
  )
  const currentProgItem = getProgramItem(selectedDeptCode, parsedProgram)
  const selectedProgCode = currentProgItem?.code ?? parsedProgram

  const availablePrograms = getDepartmentPrograms(selectedDeptCode)
  const programOptions =
    selectedProgCode &&
      !availablePrograms.some((p) => p.code === selectedProgCode)
      ? [{ code: selectedProgCode, name: selectedProgCode }, ...availablePrograms]
      : availablePrograms

  const yearOptions = getYearLevelOptions(selectedDeptCode || departmentValue)

  return (
    <div className={cn(layout.section, "space-y-6")}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-neutral-300 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-wider text-neutral-900 uppercase">
            PROPONENT {index + 1}
          </span>
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(proponent.id)}
            className="cursor-pointer gap-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-12">
        <div className="space-y-1.5 md:col-span-4">
          <label className="block text-xs font-medium text-neutral-700">
            First Name <span className="text-red-500">*</span>
          </label>
          <Input
            name={`proponent_${index}_firstName`}
            value={proponent.firstName}
            maxLength={35}
            onChange={(e) => onUpdate(proponent.id, "firstName", e.target.value)}
            placeholder="First Name"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.firstName`} />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <label className="block text-xs font-medium text-neutral-700">
            Middle Name
          </label>
          <Input
            name={`proponent_${index}_middleName`}
            value={proponent.middleName}
            maxLength={20}
            onChange={(e) =>
              onUpdate(proponent.id, "middleName", e.target.value)
            }
            placeholder="Middle Name"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <label className="block text-xs font-medium text-neutral-700">
            Last Name <span className="text-red-500">*</span>
          </label>
          <Input
            name={`proponent_${index}_lastName`}
            value={proponent.lastName}
            maxLength={30}
            onChange={(e) => onUpdate(proponent.id, "lastName", e.target.value)}
            placeholder="Last Name"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.lastName`} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-xs font-medium text-neutral-700">
            Suffix
          </label>
          <Select
            value={
              SUFFIX_OPTIONS.find(
                (opt) => opt.value.toLowerCase() === (proponent.suffix || "").toLowerCase()
              )?.value ?? (proponent.suffix || "none")
            }
            onValueChange={(val) => {
              if (typeof val === "string") {
                onUpdate(proponent.id, "suffix", val === "none" ? "" : val)
              }
            }}
          >
            <SelectTrigger
              className="h-9.5 w-full min-w-0 truncate rounded-lg border-neutral-300 bg-white !text-neutral-900"
            >
              <SelectValue placeholder="None">
                {proponent.suffix || "None"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="animate-in fade-in-80 z-50 max-h-72 rounded-xl bg-white p-1.5 text-neutral-900"
              style={SELECT_CONTENT_STYLE}
            >
              {SUFFIX_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className={SELECT_ITEM_CLASS}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name={`proponent_${index}_suffix`}
            value={proponent.suffix}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-12">
        <div className="space-y-1.5 md:col-span-3">
          <label className="block text-xs font-medium text-neutral-700">
            Student Number <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            name={`proponent_${index}_studentNumber`}
            placeholder="202XXXXXXX"
            minLength={STUDENT_NUMBER_LENGTH}
            maxLength={STUDENT_NUMBER_LENGTH}
            value={proponent.studentNumber}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) =>
              onUpdate(
                proponent.id,
                "studentNumber",
                sanitizeIntegerInput(e.target.value).slice(0, STUDENT_NUMBER_LENGTH)
              )
            }
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.studentNumber`} />
        </div>

        <div className="space-y-1.5 md:col-span-3">
          <label className="block text-xs font-medium text-neutral-700">
            Department <span className="text-red-500">*</span>
          </label>
          <Select
            value={selectedDeptCode}
            onValueChange={(val) => {
              if (typeof val === "string") {
                onDepartmentChange(proponent.id, val)
                const newPrograms = getDepartmentPrograms(val)
                const isProgValid = Boolean(
                  selectedProgCode &&
                    newPrograms.some((p) => p.code === selectedProgCode)
                )
                const newYearOptions = getYearLevelOptions(val)
                const isYearValid = Boolean(
                  currentYear &&
                    (newYearOptions as readonly string[]).includes(currentYear)
                )

                const nextProg = isProgValid ? selectedProgCode : ""
                const nextYear = isYearValid ? currentYear : ""

                if (!isProgValid || !isYearValid) {
                  const combined =
                    nextProg && nextYear
                      ? `${nextProg} - ${nextYear}`
                      : nextProg || nextYear
                  onUpdate(proponent.id, "programAndYear", combined)
                }
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "h-9.5 w-full truncate rounded-lg border-neutral-300 bg-white !text-neutral-900",
                !selectedDeptCode && "saaf-glow-invalid"
              )}
            >
              <SelectValue placeholder="Select Department">
                {selectedDeptCode || "Select Department"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="animate-in fade-in-80 z-50 max-h-72 rounded-xl bg-white p-1.5 text-neutral-900"
              style={SELECT_CONTENT_STYLE}
            >
              {DEPARTMENT_GROUPS.map((group) => (
                <SelectGroup key={group.campus}>
                  <SelectGroupLabel className="px-2 py-1.5 text-xs font-semibold text-neutral-500">
                    {group.campus}
                  </SelectGroupLabel>
                  {group.departments.map((dept) => (
                    <SelectItem key={dept.code} value={dept.code} className={SELECT_ITEM_CLASS}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name={`proponent_${index}_department`}
            value={selectedDeptCode}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.department`} />
        </div>

        <div className="space-y-1.5 md:col-span-3">
          <label className="block text-xs font-medium text-neutral-700">
            Program <span className="text-red-500">*</span>
          </label>
          <Select
            value={selectedProgCode}
            disabled={!selectedDeptCode}
            onValueChange={(val) => {
              if (typeof val === "string") {
                const combined = currentYear ? `${val} - ${currentYear}` : val
                onUpdate(proponent.id, "programAndYear", combined)
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "h-9.5 w-full truncate rounded-lg border-neutral-300 bg-white !text-neutral-900",
                !selectedDeptCode &&
                "cursor-not-allowed bg-neutral-100/70 text-neutral-400 opacity-70",
                selectedDeptCode && !selectedProgCode && "saaf-glow-invalid"
              )}
            >
              <SelectValue
                placeholder={
                  selectedDeptCode ? "Select Program" : "Select Department first"
                }
              >
                {selectedProgCode ||
                  (selectedDeptCode ? "Select Program" : "Select Department first")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="animate-in fade-in-80 z-50 max-h-72 rounded-xl bg-white p-1.5 text-neutral-900"
              style={SELECT_CONTENT_STYLE}
            >
              {programOptions.map((prog) => (
                <SelectItem key={prog.code} value={prog.code} className={SELECT_ITEM_CLASS}>
                  {prog.name === prog.code ? prog.code : `${prog.name} (${prog.code})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldWarning name={`proponent.${proponent.id}.programAndYear`} />
        </div>

        <div className="space-y-1.5 md:col-span-3">
          <label className="block text-xs font-medium text-neutral-700">
            Year Level <span className="text-red-500">*</span>
          </label>
          <Select
            value={currentYear}
            onValueChange={(val) => {
              if (typeof val === "string") {
                const combined = selectedProgCode
                  ? `${selectedProgCode} - ${val}`
                  : val
                onUpdate(proponent.id, "programAndYear", combined)
              }
            }}
          >
            <SelectTrigger
              className={cn(
                "h-9.5 w-full truncate rounded-lg border-neutral-300 bg-white !text-neutral-900",
                !currentYear && "saaf-glow-invalid"
              )}
            >
              <SelectValue placeholder="Select Year">
                {currentYear || "Select Year"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="animate-in fade-in-80 z-50 max-h-72 rounded-xl bg-white p-1.5 text-neutral-900"
              style={SELECT_CONTENT_STYLE}
            >
              {yearOptions.map((yr) => (
                <SelectItem key={yr} value={yr} className={SELECT_ITEM_CLASS}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name={`proponent_${index}_programAndYear`}
            value={proponent.programAndYear}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Position of the Applicant <span className="text-red-500">*</span>
          </label>
          <Input
            name={`proponent_${index}_positionOfApplicant`}
            value={proponent.positionOfApplicant}
            maxLength={30}
            onChange={(e) =>
              onUpdate(proponent.id, "positionOfApplicant", e.target.value)
            }
            placeholder="President / Project Lead"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.positionOfApplicant`} />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Name of Organization <span className="text-red-500">*</span>
          </label>
          <Input
            name={`proponent_${index}_orgOrCourseSection`}
            value={organizationValue}
            readOnly
            tabIndex={-1}
            placeholder="Organization Name"
            style={{ color: "#171717" }}
            className={`${FIELD_INPUT_CLASS} cursor-not-allowed bg-neutral-100/70 select-none px-3`}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.orgOrCourseSection`} />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Date of Submission <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={submissionDate}
            readOnly
            tabIndex={-1}
            style={{ color: "#171717" }}
            className={`${FIELD_INPUT_CLASS} cursor-not-allowed bg-neutral-100/70 select-none px-3`}
          />
          <input
            type="hidden"
            name={`proponent_${index}_dateOfSubmission`}
            value={submissionDate}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            name={`proponent_${index}_contactNumber`}
            placeholder="09XXXXXXXXX"
            minLength={MOBILE_NUMBER_LENGTH}
            maxLength={MOBILE_NUMBER_LENGTH}
            value={proponent.contactNumber}
            onKeyDown={blockNonIntegerKeys}
            onFocus={() => {
              if (!proponent.contactNumber) {
                onUpdate(proponent.id, "contactNumber", "09")
              }
            }}
            onBlur={() => {
              if (proponent.contactNumber === "09" || proponent.contactNumber === "0") {
                onUpdate(proponent.id, "contactNumber", "")
              }
            }}
            onChange={(e) => {
              const sanitized = sanitizeMobileNumber(
                e.target.value,
                proponent.contactNumber
              )
              onUpdate(proponent.id, "contactNumber", sanitized)
            }}
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.contactNumber`} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Email Address <span className="text-red-500">*</span>
          </label>
          <Input
            type="email"
            pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            title="Please enter a valid email address with an '@' and domain (e.g., student@mymail.mapua.edu.ph)"
            name={`proponent_${index}_emailAddress`}
            value={proponent.emailAddress}
            onChange={(e) =>
              onUpdate(proponent.id, "emailAddress", e.target.value)
            }
            placeholder="student@mymail.mapua.edu.ph"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.emailAddress`} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Facebook Link <span className="text-red-500">*</span>
          </label>
          <Input
            type="url"
            name={`proponent_${index}_facebookLink`}
            value={proponent.facebookLink}
            onChange={(e) =>
              onUpdate(proponent.id, "facebookLink", e.target.value)
            }
            placeholder="https://facebook.com/username"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.facebookLink`} />
        </div>
      </div>
    </div>
  )
})