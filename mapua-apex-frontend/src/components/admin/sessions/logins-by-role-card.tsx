import { UsersIcon, GraduationCapIcon, FileCheck2Icon, ShieldCheckIcon } from "lucide-react";
import type { LoginsByRoleMap } from "@/types/logs";

interface LoginsByRoleCardProps {
  loginsByRole?: LoginsByRoleMap;
  isLoading?: boolean;
}

export function LoginsByRoleCard({ loginsByRole, isLoading }: LoginsByRoleCardProps) {
  const studentCount = loginsByRole?.student ?? 0;
  const signatoryCount = loginsByRole?.signatory ?? 0;
  const adminCount = loginsByRole?.admin ?? 0;

  const totalRoleLogins = studentCount + signatoryCount + adminCount;

  const studentPct = totalRoleLogins > 0 ? Math.round((studentCount / totalRoleLogins) * 100) : 0;
  const signatoryPct = totalRoleLogins > 0 ? Math.round((signatoryCount / totalRoleLogins) * 100) : 0;
  const adminPct = totalRoleLogins > 0 ? Math.round((adminCount / totalRoleLogins) * 100) : 0;

  const breakdown = loginsByRole?.signatoriesBreakdown ?? {
    adviser: 0,
    dean: 0,
    osaar: 0,
    cdm: 0,
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-3">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
        <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
          <UsersIcon className="h-4 w-4 text-[#8B0000]" />
          Logins by Role
        </span>
        {!isLoading && (
          <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
            {totalRoleLogins.toLocaleString()} total
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5 animate-pulse py-1">
          <div className="h-14 bg-neutral-100 rounded-xl w-full" />
          <div className="h-20 bg-neutral-100 rounded-xl w-full" />
          <div className="h-14 bg-neutral-100 rounded-xl w-full" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Students Card */}
          <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/70 p-3 flex items-center justify-between hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-neutral-200/80 text-neutral-700 flex items-center justify-center shrink-0">
                <GraduationCapIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-800">Students</div>
                <div className="text-[11px] text-neutral-500 font-medium">
                  {studentPct}% of total sessions
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-neutral-900">
                {studentCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Signatories Card */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 space-y-2.5 hover:bg-amber-50/60 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <FileCheck2Icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-950">Signatories</div>
                  <div className="text-[11px] text-amber-700/90 font-medium">
                    {signatoryPct}% of total sessions
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold font-mono text-amber-950">
                  {signatoryCount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Signatory sub-breakdown chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-amber-200/40">
              <div className="bg-white/90 border border-amber-200/70 rounded-lg px-2 py-1 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-amber-800">Adviser</span>
                <span className="font-bold font-mono text-amber-950">{breakdown.adviser}</span>
              </div>
              <div className="bg-purple-50/90 border border-purple-200/70 rounded-lg px-2 py-1 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-purple-700">Dean</span>
                <span className="font-bold font-mono text-purple-950">{breakdown.dean}</span>
              </div>
              <div className="bg-emerald-50/90 border border-emerald-200/70 rounded-lg px-2 py-1 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-emerald-700">OSAAR</span>
                <span className="font-bold font-mono text-emerald-950">{breakdown.osaar}</span>
              </div>
              <div className="bg-teal-50/90 border border-teal-200/70 rounded-lg px-2 py-1 flex items-center justify-between text-[10px]">
                <span className="font-semibold text-teal-700">CDM</span>
                <span className="font-bold font-mono text-teal-950">{breakdown.cdm}</span>
              </div>
            </div>
          </div>

          {/* Administrators Card */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3 flex items-center justify-between hover:bg-blue-50/60 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <ShieldCheckIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-blue-950">Administrators</div>
                <div className="text-[11px] text-blue-700/90 font-medium">
                  {adminPct}% of total sessions
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-blue-950">
                {adminCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
