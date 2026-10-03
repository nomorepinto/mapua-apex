import { Check } from "lucide-react"

import { EQUIPMENT_OPTIONS } from "@/components/reservation/constants"
import type { EquipmentFlags } from "@/components/reservation/types"

export function EquipmentSection({
  equipment,
  otherEquipmentText,
  onToggle,
  onOtherTextChange,
}: {
  equipment: EquipmentFlags
  otherEquipmentText: string
  onToggle: (key: keyof EquipmentFlags, checked: boolean) => void
  onOtherTextChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-neutral-900">Equipment Requested:</p>
      <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-1.5 text-xs text-neutral-800 sm:grid-cols-2">
        {EQUIPMENT_OPTIONS.map((option) => {
          const checked = Boolean(equipment?.[option.key])
          return (
            <label
              key={option.key}
              className="flex cursor-pointer items-center gap-2 py-0.5 select-none"
            >
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle(option.key, e.target.checked)}
                  className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-neutral-400 bg-white checked:border-[#990000] checked:bg-[#990000] focus:outline-none"
                />
                {checked && (
                  <Check className="pointer-events-none absolute h-3 w-3 text-white stroke-[3]" />
                )}
              </div>
              <span className="font-medium text-neutral-800">{option.label}</span>
            </label>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 pt-0.5 text-xs text-neutral-800 sm:flex-row sm:items-center">
        <label className="flex shrink-0 cursor-pointer items-center gap-2 py-0.5 select-none">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              checked={Boolean(equipment?.others)}
              onChange={(e) => onToggle("others", e.target.checked)}
              className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-neutral-400 bg-white checked:border-[#990000] checked:bg-[#990000] focus:outline-none"
            />
            {equipment?.others && (
              <Check className="pointer-events-none absolute h-3 w-3 text-white stroke-[3]" />
            )}
          </div>
          <span className="font-medium text-neutral-800">Others (please indicate):</span>
        </label>
        <input
          type="text"
          placeholder="Label"
          maxLength={40}
          value={otherEquipmentText}
          onChange={(e) => onOtherTextChange(e.target.value)}
          style={{ color: "#171717" }}
          className="w-full max-w-md border-b border-dashed border-neutral-400 bg-transparent px-1 py-0.5 text-xs !text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-700 focus:outline-none"
        />
      </div>
    </div>
  )
}