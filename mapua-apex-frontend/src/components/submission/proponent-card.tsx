import { memo } from "react"
import { Trash2Icon } from "lucide-react"

import { FieldWarning } from "@/components/forms/field-warning"
import {
  DEPARTMENTS,
  FIELD_INPUT_CLASS,
  SELECT_CONTENT_STYLE,
  SELECT_ITEM_CLASS,
} from "@/components/submission/constants"
import type { Proponent } from "@/components/submission/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

interface ProponentCardProps {
  proponent: Proponent
  index: number
  canRemove: boolean
  departmentValue: string
  onUpdate: (id: string, field: keyof Proponent, value: string) => void
  onRemove: (id: string) => void
  onDepartmentChange: (id: string, value: string) => void
}

export const ProponentCard = memo(function ProponentCard({
  proponent,
  index,
  canRemove,
  departmentValue,
  onUpdate,
  onRemove,
  onDepartmentChange,
}: ProponentCardProps) {
  const today = new Date().toISOString().split("T")[0]
  const submissionDate = proponent.dateOfSubmission || today

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
        <div className="space-y-1.5 md:col-span-4">
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
        <div className="space-y-1.5 md:col-span-1">
          <label className="block text-xs font-medium text-neutral-700">
            Suffix
          </label>
          <Input
            name={`proponent_${index}_suffix`}
            value={proponent.suffix}
            maxLength={7}
            onChange={(e) => onUpdate(proponent.id, "suffix", e.target.value)}
            placeholder="Jr."
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Student Number <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            name={`proponent_${index}_studentNumber`}
            placeholder="202XXXXXXX"
            maxLength={10}
            value={proponent.studentNumber}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) =>
              onUpdate(
                proponent.id,
                "studentNumber",
                sanitizeIntegerInput(e.target.value).slice(0, 10)
              )
            }
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.studentNumber`} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Program and Year <span className="text-red-500">*</span>
          </label>
          <Input
            name={`proponent_${index}_programAndYear`}
            value={proponent.programAndYear}
            maxLength={20}
            onChange={(e) =>
              onUpdate(proponent.id, "programAndYear", e.target.value)
            }
            placeholder="BSCS - 3rd Year"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.programAndYear`} />
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
            Department <span className="text-red-500">*</span>
          </label>
          <Select
            value={departmentValue}
            onValueChange={(val) => {
              if (typeof val === "string") onDepartmentChange(proponent.id, val)
            }}
          >
            <SelectTrigger
              className={cn(
                "h-9.5 w-full truncate rounded-lg border-neutral-300 bg-white !text-neutral-900",
                !departmentValue && "saaf-glow-invalid"
              )}
            >
              <SelectValue placeholder="Select Department">
                {departmentValue || "Select Department"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="animate-in fade-in-80 z-50 max-h-72 rounded-xl bg-white p-1.5 text-neutral-900"
              style={SELECT_CONTENT_STYLE}
            >
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept} className={SELECT_ITEM_CLASS}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name={`proponent_${index}_department`}
            value={departmentValue}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.department`} />
        </div>

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
            Name of Organization / Course and Section{" "}
            <span className="text-red-500">*</span>
          </label>
          <Input
            name={`proponent_${index}_orgOrCourseSection`}
            value={proponent.orgOrCourseSection}
            onChange={(e) =>
              onUpdate(proponent.id, "orgOrCourseSection", e.target.value)
            }
            placeholder="Organization Name"
            style={{ color: "#171717" }}
            className={FIELD_INPUT_CLASS}
            required
          />
          <FieldWarning name={`proponent.${proponent.id}.orgOrCourseSection`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Contact Number <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            name={`proponent_${index}_contactNumber`}
            placeholder="09XXXXXXXXX"
            maxLength={11}
            value={proponent.contactNumber}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) =>
              onUpdate(
                proponent.id,
                "contactNumber",
                sanitizeIntegerInput(e.target.value).slice(0, 11)
              )
            }
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