import { UsersIcon } from "lucide-react"

import { DevCard } from "@/components/about/dev-card"
import { TEAM_MEMBERS } from "@/components/about/team"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function DevelopmentTeam() {
  return (
    <>
      <div className={layout.section}>
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <UsersIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E293B]">
              Development Team
            </h2>
            <p className="text-xs text-neutral-600">The people behind the portal</p>
          </div>
        </div>

        <div className="mt-3 mb-5 flex flex-wrap items-center gap-4 pl-0.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#D9291C]" />
            <span className="text-[11px] font-semibold text-[#64748B]">
              Council of Organizations Role
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="text-[11px] font-semibold text-[#64748B]">
              AWS-SBG Arcus Role
            </span>
          </div>
        </div>
      </div>

      <div className={cn(layout.grid4, layout.gap)}>
        {TEAM_MEMBERS.map((member) => (
          <DevCard key={member.name} member={member} />
        ))}
      </div>
    </>
  )
}
