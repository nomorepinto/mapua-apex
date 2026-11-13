import { FieldWarning } from "@/components/forms/field-warning"
import type { SaafDraft } from "@/components/submission/types"
import { Input } from "@/components/ui/input"
import { blockNonIntegerKeys, sanitizeIntegerInput } from "@/lib/numeric-input"
import { cn } from "@/lib/utils"

type ParticipantValues = Pick<
  SaafDraft,
  | "expectedParticipants"
  | "includeNonMapua"
  | "mapuaParticipants"
  | "nonMapuaParticipants"
>

/**
 * Derived total (S-6): the Mapua count plus the non-Mapua count only while the
 * switch is ON. Blank stays blank so the required-field rules still fire.
 */
export function participantTotal(
  mapua: string,
  nonMapua: string,
  includeNonMapua: boolean
): string {
  const extra = includeNonMapua ? nonMapua : ""
  if (!mapua.trim() && !extra.trim()) return ""
  return String(Number(mapua || 0) + Number(extra || 0))
}

/**
 * S-6 participant split, shared by the Activity step (no-reservation flow) and
 * the Reservation step. `expectedParticipants` stays the derived total so room
 * capacity checks and existing readers keep working. The non-Mapua payment
 * note is text only — no amount, fee, or payee is computed (pending Q-A).
 */
export function ParticipantFields({
  values,
  onChange,
}: {
  values: ParticipantValues
  onChange: (key: any, value: any) => void
}) {
  const commitTotal = (mapua: string, nonMapua: string, include: boolean) => {
    onChange("expectedParticipants", participantTotal(mapua, nonMapua, include))
  }

  const handleMapua = (raw: string) => {
    const next = sanitizeIntegerInput(raw).slice(0, 4)
    onChange("mapuaParticipants", next)
    commitTotal(next, values.nonMapuaParticipants, values.includeNonMapua)
  }

  const handleNonMapua = (raw: string) => {
    const next = sanitizeIntegerInput(raw).slice(0, 4)
    onChange("nonMapuaParticipants", next)
    commitTotal(values.mapuaParticipants, next, true)
  }

  const handleSwitch = (checked: boolean) => {
    onChange("includeNonMapua", checked)
    // OFF forces the non-Mapua count to 0 and hides the input + note.
    const nonMapua = checked ? values.nonMapuaParticipants : "0"
    if (!checked) onChange("nonMapuaParticipants", "0")
    commitTotal(values.mapuaParticipants, nonMapua, checked)
  }

  const showNonMapuaNote =
    values.includeNonMapua && Number(values.nonMapuaParticipants || 0) > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
        <label
          htmlFor="includeNonMapua"
          className="text-xs font-semibold text-neutral-800"
        >
          Will you add non-Mapuan participants to this event?
        </label>
        <button
          type="button"
          id="includeNonMapua"
          role="switch"
          aria-checked={values.includeNonMapua}
          onClick={() => handleSwitch(!values.includeNonMapua)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
            values.includeNonMapua ? "bg-red-700" : "bg-neutral-300"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform",
              values.includeNonMapua ? "translate-x-4.5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-800">
            Mapuan Participants <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="mapuaParticipants"
            placeholder="0"
            maxLength={4}
            min={1}
            max={3000}
            value={values.mapuaParticipants}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) => handleMapua(e.target.value)}
            style={{ color: "#171717" }}
            className="no-spinner h-9.5 rounded-lg border-neutral-300 bg-white text-center !text-neutral-900 placeholder:text-neutral-400"
            required
          />
          <FieldWarning name="mapuaParticipants" />
        </div>

        {values.includeNonMapua && (
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-800">
              Non-Mapuan Participants <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="nonMapuaParticipants"
              placeholder="0"
              maxLength={4}
              min={1}
              max={3000}
              value={values.nonMapuaParticipants}
              onKeyDown={blockNonIntegerKeys}
              onChange={(e) => handleNonMapua(e.target.value)}
              style={{ color: "#171717" }}
              className="no-spinner h-9.5 rounded-lg border-neutral-300 bg-white text-center !text-neutral-900 placeholder:text-neutral-400"
              required
            />
            <FieldWarning name="nonMapuaParticipants" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <span className="block text-[10px] text-neutral-500">
          Total expected participants: {values.expectedParticipants || "0"}{" "}
          (between 20 and 3,000)
        </span>
        <FieldWarning name="expectedParticipants" />
      </div>

      {showNonMapuaNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          Non-Mapuan participants may be subject to payment requirements. The
          applicable fees will be coordinated with your organization separately.
        </p>
      )}
    </div>
  )
}