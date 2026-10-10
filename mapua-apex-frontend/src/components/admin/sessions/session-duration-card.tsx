import { ClockIcon } from "lucide-react";

interface SessionDurationCardProps {
  avgMinutes?: number;
  loggedOutCount?: number;
  isLoading?: boolean;
}

export function SessionDurationCard({
  avgMinutes = 0,
  loggedOutCount = 0,
  isLoading,
}: SessionDurationCardProps) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-2">
      <div className="flex items-center justify-between text-neutral-500">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4 text-[#8B0000]" />
          Average Session Duration
        </span>
      </div>
      {isLoading ? (
        <div className="space-y-2 animate-pulse py-1">
          <div className="h-8 w-28 bg-neutral-200 rounded-lg" />
          <div className="h-6 w-full bg-neutral-100 rounded-lg" />
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold text-neutral-900">
            {avgMinutes}{" "}
            <span className="text-sm font-semibold text-neutral-500">mins</span>
          </div>
          <p className="text-[11px] text-neutral-500 font-medium bg-neutral-50 rounded-lg p-2 border border-neutral-200">
            Based on logged-out sessions (n = {loggedOutCount})
          </p>
        </>
      )}
    </div>
  );
}
