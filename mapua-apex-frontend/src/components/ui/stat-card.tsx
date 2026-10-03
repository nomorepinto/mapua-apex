import { memo } from "react"
import type { StatItem } from "./activity.data"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

const StatCard = memo(function StatCard({ label, value }: StatItem) {
  return (
    <div className={cn(layout.section, "space-y-4 transition-all hover:shadow-md")}>
      <span className="block text-xs sm:text-sm font-semibold text-neutral-600 leading-tight">
        {label}
      </span>
      <div>
        <span className="text-4xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight font-sans">
          {value}
        </span>
      </div>
    </div>
  )
})

export { StatCard }
