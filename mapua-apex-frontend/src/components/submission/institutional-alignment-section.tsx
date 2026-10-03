import { FieldWarning } from "@/components/forms/field-warning"
import { MISSION_STATEMENTS } from "@/components/submission/constants"
import type { SaafDraft } from "@/components/submission/types"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type AlignmentFields = Pick<
  SaafDraft,
  | "mission1"
  | "mission2"
  | "mission3"
  | "coreValuesExplanation"
  | "peoExplanation"
  | "sdgExplanation"
>

export function InstitutionalAlignmentSection({
  values,
  onChange,
}: {
  values: AlignmentFields
  onChange: <K extends keyof SaafDraft>(key: K, value: SaafDraft[K]) => void
}) {
  const atLeastOneSelected =
    Boolean(values.mission1) || Boolean(values.mission2) || Boolean(values.mission3)

  const coreValuesLen = (values.coreValuesExplanation || "").length
  const peoLen = (values.peoExplanation || "").length
  const sdgLen = (values.sdgExplanation || "").length

  return (
    <div className="space-y-6 pt-4">
      <div className="border-b border-neutral-200 pb-2">
        <h2 className="text-base font-bold tracking-tight text-neutral-900">
          Alignment with institutional vision, mission, and formation goals
        </h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-800">
            Check the mission statement(s) satisfied by the nature of your activity:{" "}
            <span className="text-red-500">*</span>
          </p>
        </div>

        <div
          className={cn(
            "space-y-3 p-3 rounded-xl border border-transparent transition-all",
            !atLeastOneSelected && "saaf-glow-invalid"
          )}
        >
          {MISSION_STATEMENTS.map((mission) => {
            const checked = values[mission.key]
            return (
              <label
                key={mission.key}
                className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-neutral-800 select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  required={!atLeastOneSelected}
                  onChange={(e) => onChange(mission.key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border border-neutral-400 text-red-700 accent-red-700 focus:ring-red-700"
                />
                <span>{mission.text}</span>
                <input
                  type="hidden"
                  name={mission.name}
                  value={checked ? "true" : "false"}
                />
              </label>
            )
          })}
        </div>
        <FieldWarning name="mission" />

        <div className="space-y-1.5 pt-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-neutral-900">
              Enumerate and briefly explain the applicable Mapua Core Values honed
              or formed by reason of your activity
            </label>
            <span
              className={`text-[11px] ${coreValuesLen < 30 ? "font-medium text-amber-600" : "text-neutral-400"
                }`}
            >
              {coreValuesLen}/30 min
            </span>
          </div>
          <p className="text-xs font-normal text-neutral-500">
            (Discipline, Excellence, Commitment, Integrity and Relevance){" "}
            <span className="text-red-500">*</span>
          </p>
          <Textarea
            name="coreValuesExplanation"
            value={values.coreValuesExplanation}
            minLength={30}
            onChange={(e) => onChange("coreValuesExplanation", e.target.value)}
            placeholder="Discuss how the activity fosters these core values (minimum 30 characters required)..."
            rows={4}
            style={{ color: "#171717" }}
            className="mt-1 rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900 placeholder:text-neutral-400"
            required
          />
          <FieldWarning name="coreValuesExplanation" />
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-neutral-900">
              If and when applicable, enumerate the Program Educational Objectives
              (PEO) or Program Objectives (PO) Satisfied in this Activity (Optional)
            </label>
            <span
              className={`text-[11px] ${peoLen > 0 && peoLen < 30
                ? "font-medium text-amber-600"
                : "text-neutral-400"
                }`}
            >
              {peoLen}/30 min
            </span>
          </div>
          <Textarea
            name="peoExplanation"
            value={values.peoExplanation}
            minLength={30}
            onChange={(e) => onChange("peoExplanation", e.target.value)}
            placeholder="Indicate which academic objectives are satisfied, if this applies."
            rows={4}
            style={{ color: "#171717" }}
            className="mt-1 rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900 placeholder:text-neutral-400"
          />
          <FieldWarning name="peoExplanation" />
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-neutral-900">
              Include the United Nation Sustainability Goals and How is the
              Organization going to implement, and Audit the impact{" "}
              <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[11px] ${sdgLen < 30 ? "font-medium text-amber-600" : "text-neutral-400"
                }`}
            >
              {sdgLen}/30 min
            </span>
          </div>
          <Textarea
            name="sdgExplanation"
            value={values.sdgExplanation}
            minLength={30}
            onChange={(e) => onChange("sdgExplanation", e.target.value)}
            placeholder="Specify targeted SDGs and your audit methodology (minimum 30 characters required)..."
            rows={4}
            style={{ color: "#171717" }}
            className="mt-1 rounded-lg border-neutral-300 bg-white text-sm !text-neutral-900 placeholder:text-neutral-400"
            required
          />
          <FieldWarning name="sdgExplanation" />
        </div>
      </div>
    </div>
  )
}