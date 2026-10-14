import { FileCheck2Icon, StampIcon, FileEditIcon } from "lucide-react";
import type { ActivityAnalyticsResponse } from "@/types/logs";

interface ActivityStatCardsProps {
  stats?: ActivityAnalyticsResponse;
}

export function ActivityStatCards({ stats }: ActivityStatCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Card 1: Submissions Range */}
      <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
        <div className="flex items-center justify-between text-neutral-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Submissions</span>
          <FileCheck2Icon className="h-4 w-4 text-blue-600" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{stats?.submissionsToday ?? 0}</div>
        <p className="text-[10px] text-neutral-400 mt-1">Submitted in range</p>
      </div>

      {/* Card 2: Adviser Reviews */}
      <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
        <div className="flex items-center justify-between text-neutral-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Adviser</span>
          <StampIcon className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{stats?.adviserReviews ?? 0}</div>
        <p className="text-[10px] text-neutral-400 mt-1">Adviser review decisions</p>
      </div>

      {/* Card 3: Dean Reviews */}
      <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
        <div className="flex items-center justify-between text-neutral-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Dean</span>
          <StampIcon className="h-4 w-4 text-purple-600" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{stats?.deanReviews ?? 0}</div>
        <p className="text-[10px] text-neutral-400 mt-1">Dean office decisions</p>
      </div>

      {/* Card 4: OSAAR Reviews */}
      <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
        <div className="flex items-center justify-between text-neutral-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">OSAAR</span>
          <StampIcon className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{stats?.osaarReviews ?? 0}</div>
        <p className="text-[10px] text-neutral-400 mt-1">OSAAR desk decisions</p>
      </div>

      {/* Card 5: CDM Reviews */}
      <div className="rounded-2xl bg-white p-4 shadow-xs border border-neutral-200 flex flex-col justify-between">
        <div className="flex items-center justify-between text-neutral-500 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">CDM</span>
          <StampIcon className="h-4 w-4 text-teal-600" />
        </div>
        <div className="text-2xl font-bold text-neutral-900">{stats?.cdmReviews ?? 0}</div>
        <p className="text-[10px] text-neutral-400 mt-1">Campus Decisions</p>
      </div>

      {/* Card 6: In-Edit (Submissions status = returned) */}
      <div className="rounded-2xl bg-amber-50/70 p-4 shadow-xs border border-amber-200 flex flex-col justify-between">
        <div className="flex items-center justify-between text-amber-800 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider">In-Edit</span>
          <FileEditIcon className="h-4 w-4 text-amber-600" />
        </div>
        <div className="text-2xl font-bold text-amber-900">{stats?.inEditSubmissions ?? 0}</div>
        <p className="text-[10px] text-amber-700 mt-1">Returned for student revision</p>
      </div>
    </div>
  );
}
