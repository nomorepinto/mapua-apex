import { BarChart3Icon, TrendingUpIcon } from "lucide-react";
import type { LoginVolumeTimeComparison } from "@/types/logs";

interface SessionVolumeChartProps {
  loginVolume?: LoginVolumeTimeComparison;
  compareMode: "month" | "year";
  onToggleCompareMode: (mode: "month" | "year") => void;
  isLoading?: boolean;
}

export function SessionVolumeChart({
  loginVolume,
  compareMode,
  onToggleCompareMode,
  isLoading,
}: SessionVolumeChartProps) {
  const hours = loginVolume?.hours ?? [
    "00:00", "02:00", "04:00", "06:00", "08:00", "10:00",
    "12:00", "14:00", "16:00", "18:00", "20:00", "22:00",
  ];
  const today = loginVolume?.today ?? [];
  const monthAvg = loginVolume?.monthAvg ?? [];
  const yearAvg = loginVolume?.yearAvg ?? [];

  const maxVal = Math.max(...today, ...monthAvg, ...yearAvg, 1);

  // Calculate peak hour
  let peakIndex = -1;
  let peakTodayVal = 0;
  today.forEach((val, idx) => {
    if (val > peakTodayVal) {
      peakTodayVal = val;
      peakIndex = idx;
    }
  });
  const peakHour = peakIndex >= 0 ? hours[peakIndex] : null;

  return (
    <div className="lg:col-span-2 rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 flex flex-col justify-between h-full space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-wider">
              <BarChart3Icon className="h-4 w-4 text-[#8B0000]" />
              Login Volume by Hour of Day
            </h2>
            {peakHour && peakTodayVal > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-[#8B0000] border border-red-200">
                <TrendingUpIcon className="h-3 w-3" />
                Peak at {peakHour} ({peakTodayVal} logins)
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Overlaid comparison of login traffic trends across time periods.
          </p>
        </div>

        {/* Toggle: Compare vs Month / Year */}
        <div className="flex items-center rounded-xl bg-neutral-100 p-1 text-xs font-semibold border border-neutral-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onToggleCompareMode("month")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              compareMode === "month"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            vs Month Avg
          </button>
          <button
            type="button"
            onClick={() => onToggleCompareMode("year")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              compareMode === "year"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            vs Year Avg
          </button>
        </div>
      </div>

      {/* Responsive Bar Visualizer filling all available vertical space */}
      {isLoading ? (
        <div className="flex-1 min-h-[220px] lg:min-h-[270px] flex items-end justify-between gap-2 pt-6 border-b border-neutral-100 pb-3 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                style={{ height: `${25 + ((i * 17) % 65)}%` }}
                className="w-full bg-neutral-200 rounded-t-md"
              />
              <span className="h-2 w-6 bg-neutral-200 rounded font-mono" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-[220px] lg:min-h-[270px] flex items-end justify-between gap-2 pt-6 border-b border-neutral-100 pb-3">
          {hours.map((hr, idx) => {
            const todayVal = today[idx] || 0;
            const compVal = compareMode === "month" ? monthAvg[idx] || 0 : yearAvg[idx] || 0;

            const todayPct = todayVal > 0 ? Math.max((todayVal / maxVal) * 100, 4) : 0;
            const compPct = compVal > 0 ? Math.max((compVal / maxVal) * 100, 4) : 0;

            return (
              <div key={hr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-0.5 h-full relative">
                  {/* Today Bar */}
                  <div
                    style={{ height: `${todayPct}%` }}
                    className="w-1/2 bg-[#8B0000] rounded-t-md transition-all group-hover:bg-[#6b0000] relative shadow-2xs"
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-5 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[9px] px-1.5 py-0.5 rounded z-20 whitespace-nowrap pointer-events-none shadow-md">
                      Today: {todayVal}
                    </span>
                  </div>
                  {/* Comparison Avg Bar */}
                  <div
                    style={{ height: `${compPct}%` }}
                    className="w-1/2 bg-neutral-300 rounded-t-md transition-all group-hover:bg-neutral-400 relative"
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-9 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[9px] px-1.5 py-0.5 rounded z-20 whitespace-nowrap pointer-events-none shadow-md">
                      {compareMode === "month" ? "Month" : "Year"} Avg: {compVal}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] text-neutral-400 font-mono tracking-tighter sm:tracking-normal">
                  {hr}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart Footer with Legend & Highlights */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        {peakHour && peakTodayVal > 0 ? (
          <div className="text-[11px] text-neutral-500 font-medium sm:hidden">
            Peak: <strong className="text-neutral-800">{peakHour}</strong> ({peakTodayVal} logins)
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-4 text-xs ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[#8B0000]" />
            <span className="font-semibold text-neutral-700">Selected Date</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-neutral-300" />
            <span className="font-semibold text-neutral-700">
              {compareMode === "month" ? "This Month (Daily Avg)" : "This Year (Daily Avg)"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
