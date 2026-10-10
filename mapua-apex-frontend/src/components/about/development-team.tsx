import { UsersIcon } from "lucide-react"

import { DevCard } from "@/components/about/dev-card"
import { TEAM_MEMBERS } from "@/components/about/team"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function DevelopmentTeam() {
  return (
    <>
      <div className={layout.section}>
        <div className="mb-2 flex items-center justify-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shadow-sm">
            <UsersIcon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-bold text-[#1E293B]">
              Development Team
            </h2>
            <p className="text-sm text-neutral-600 mt-0.5">The people behind the portal</p>
          </div>
        </div>

        <div className="mt-8 mb-6 flex flex-wrap items-center justify-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="h-3.5 w-3.5 rounded-full bg-[#D9291C] shadow-sm" />
            <span className="text-[13px] font-semibold text-[#64748B]">
              Council of Organizations Role
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3.5 w-3.5 rounded-full bg-amber-400 shadow-sm" />
            <span className="text-[13px] font-semibold text-[#64748B]">
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
