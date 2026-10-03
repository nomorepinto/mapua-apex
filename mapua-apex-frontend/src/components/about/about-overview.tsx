import type { ReactNode } from "react"
import { Building2Icon, ShieldCheckIcon } from "lucide-react"

import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AboutOverview() {
  return (
    <div className={cn(layout.grid2, layout.gap)}>
      <AboutInfoCard
        icon={<Building2Icon className="h-4.5 w-4.5" />}
        iconClassName="bg-red-50 text-[#D9291C]"
        title="System Description"
        kicker="What APEX does"
      >
        APEX streamlines the student activity proposal, review, and approval
        process across all academic departments, student councils, and
        organizations at Mapúa University. From drafting the Student Activity
        Approval Form (SAAF) to tracking multi-level signatory routing, APEX
        replaces manual paper workflows with a real-time digital pipeline.
      </AboutInfoCard>

      <AboutInfoCard
        icon={<ShieldCheckIcon className="h-4.5 w-4.5" />}
        iconClassName="bg-amber-50 text-amber-700"
        title="Unified Institutional Alignment"
        kicker="Why it matters"
      >
        Every co-curricular and extra-curricular activity submitted through
        APEX is validated against the institution's vision, core values, Program
        Educational Objectives (PEO), and the United Nations Sustainable
        Development Goals (SDGs) — ensuring purposeful student engagement and
        transparent governance at every level.
      </AboutInfoCard>
    </div>
  )
}

function AboutInfoCard({
  children,
  icon,
  iconClassName,
  kicker,
  title,
}: {
  children: string
  icon: ReactNode
  iconClassName: string
  kicker: string
  title: string
}) {
  return (
    <div className={cn(layout.section, "space-y-3")}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            iconClassName
          )}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1E293B]">{title}</h2>
          <p className="text-xs text-neutral-600">{kicker}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-[#475569]">{children}</p>
    </div>
  )
}
