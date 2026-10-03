import { FieldWarning } from "@/components/forms/field-warning"
import { Input } from "@/components/ui/input"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"

export function ActivityClassificationSection({
  activityType,
  totalOrgMembers,
  onActivityTypeChange,
  onTotalOrgMembersChange,
}: {
  activityType: string
  totalOrgMembers: string
  onActivityTypeChange: (value: string) => void
  onTotalOrgMembersChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
      <div className="space-y-3 md:col-span-8">
        <label className="block text-sm font-semibold text-neutral-800">
          Select what type of activity:
        </label>
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-normal text-neutral-700 select-none">
            <input
              type="radio"
              name="activityType"
              value="co-curricular"
              checked={activityType === "co-curricular"}
              onChange={(e) => onActivityTypeChange(e.target.value)}
              className="h-4 w-4 cursor-pointer text-red-700 accent-red-700 focus:ring-red-700"
            />
            <span>Co-curricular Activity</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-normal text-neutral-700 select-none">
            <input
              type="radio"
              name="activityType"
              value="extra-curricular"
              checked={activityType === "extra-curricular"}
              onChange={(e) => onActivityTypeChange(e.target.value)}
              className="h-4 w-4 cursor-pointer text-red-700 accent-red-700 focus:ring-red-700"
            />
            <span>Extra-curricular Activity</span>
          </label>
        </div>
        <FieldWarning name="activityType" />
      </div>

      <div className="space-y-2 md:col-span-4">
        <label className="block text-sm font-medium text-neutral-800">
          Total Number of Class / Org Members{" "}
          <span className="font-bold text-red-500">*</span>
        </label>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          name="totalOrgMembers"
          placeholder="0"
          maxLength={5}
          value={totalOrgMembers}
          onKeyDown={blockNonIntegerKeys}
          onChange={(e) =>
            onTotalOrgMembersChange(
              sanitizeIntegerInput(e.target.value).slice(0, 5)
            )
          }
          style={{ color: "#171717" }}
          className="no-spinner h-10 rounded-lg border-neutral-300 bg-white text-center !text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-red-800/20"
          required
        />
        <FieldWarning name="totalOrgMembers" />
      </div>
    </div>
  )
}