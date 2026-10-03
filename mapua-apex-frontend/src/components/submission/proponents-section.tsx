import { PlusIcon } from "lucide-react"

import { ProponentCard } from "@/components/submission/proponent-card"
import type { Proponent } from "@/components/submission/types"
import { layout } from "@/config"

export function ProponentsSection({
  proponents,
  departmentValues,
  onUpdate,
  onRemove,
  onAdd,
  onDepartmentChange,
}: {
  proponents: Proponent[]
  departmentValues: Record<string, string>
  onUpdate: (id: string, field: keyof Proponent, value: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  onDepartmentChange: (id: string, value: string) => void
}) {
  const canRemove = proponents.length > 1

  return (
    <div className={layout.stack}>
      {proponents.map((proponent, index) => (
        <ProponentCard
          key={proponent.id}
          proponent={proponent}
          index={index}
          canRemove={canRemove}
          departmentValue={departmentValues[proponent.id] ?? ""}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onDepartmentChange={onDepartmentChange}
        />
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white/40 py-3.5 text-sm font-medium text-neutral-700 shadow-xs transition-all hover:border-red-600 hover:bg-red-50/30 hover:text-red-700"
      >
        <PlusIcon className="h-4 w-4 text-neutral-600" />
        <span>Add Proponent</span>
      </button>
    </div>
  )
}
