import { layout } from "@/config"
import { cn } from "@/lib/utils"
import type { TeamMember } from "@/components/about/team"

export function DevCard({ member }: { member: TeamMember }) {
  return (
    <div className={cn(layout.section, "group overflow-hidden !p-0 transition-shadow duration-300 hover:shadow-lg")}>
      <div className="relative h-56 w-full overflow-hidden bg-neutral-100">
        <img
          src={member.photo}
          alt={member.name}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      <div className="p-4 space-y-2.5">
        <h3 className="text-lg font-extrabold tracking-tight text-[#1E293B]">
          {member.name}
        </h3>

        <div className="space-y-1.5 min-h-[3.5rem]">
          {member.coorole ? <CouncilRole role={member.coorole} /> : null}
          {member.awsrole && member.coorole ? (
            <SecondaryAwsRole role={member.awsrole} />
          ) : null}
          {member.awsrole && !member.coorole ? (
            <PrimaryAwsRole role={member.awsrole} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CouncilRole({ role }: { role: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 w-1 self-stretch shrink-0 rounded-full bg-[#D9291C]" />
      <p className="text-xs font-bold leading-snug text-[#8B0000]">{role}</p>
    </div>
  )
}

function PrimaryAwsRole({ role }: { role: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 w-1 self-stretch shrink-0 rounded-full bg-amber-400" />
      <p className="text-xs font-semibold leading-snug text-amber-700">{role}</p>
    </div>
  )
}

function SecondaryAwsRole({ role }: { role: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 w-1 self-stretch shrink-0 rounded-full bg-amber-300" />
      <p className="text-[11px] font-medium leading-snug text-amber-700">{role}</p>
    </div>
  )
}
