import { memo } from "react"
import type React from "react"

// ─── DetailItem ───────────────────────────────────────────────────────────────
// Used inside ActivityDetailModal to render labelled metadata rows.

export interface DetailItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}

const DetailItem = memo(function DetailItem({ icon: Icon, label, value }: DetailItemProps) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 p-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-500">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {label}
        </p>
        <p className="text-xs font-medium text-neutral-800 mt-0.5 leading-snug">{value}</p>
      </div>
    </div>
  )
})

export { DetailItem }
