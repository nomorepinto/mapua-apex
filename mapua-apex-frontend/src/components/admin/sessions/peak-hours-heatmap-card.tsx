import { useState } from "react";
import { GridIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import type { HeatmapCell } from "@/types/logs";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface PeakHoursHeatmapCardProps {
  heatmapData?: HeatmapCell[];
  isLoading?: boolean;
}

function getHeatmapCellOrigin(dayIdx: number, hrIdx: number): string {
  const isTop = dayIdx === 0;
  const isBottom = dayIdx === 6;
  const isLeft = hrIdx === 0;
  const isRight = hrIdx === 23;

  if (isTop && isLeft) return "origin-top-left";
  if (isTop && isRight) return "origin-top-right";
  if (isBottom && isLeft) return "origin-bottom-left";
  if (isBottom && isRight) return "origin-bottom-right";
  if (isTop) return "origin-top";
  if (isBottom) return "origin-bottom";
  if (isLeft) return "origin-left";
  if (isRight) return "origin-right";
  return "origin-center";
}

export function PeakHoursHeatmapCard({ heatmapData = [], isLoading }: PeakHoursHeatmapCardProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-xs border border-neutral-200 space-y-3">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-neutral-900 flex items-center gap-2 uppercase tracking-wider">
            <GridIcon className="h-4 w-4 text-[#8B0000]" />
            Peak Hours Heatmap (Day of Week × Hour of Day)
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowHeatmap((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer"
        >
          {showHeatmap ? (
            <>
              <EyeOffIcon className="h-3.5 w-3.5 text-neutral-500" />
              Hide Heatmap
            </>
          ) : (
            <>
              <EyeIcon className="h-3.5 w-3.5 text-[#8B0000]" />
              Show Heatmap
            </>
          )}
        </button>
      </div>

      {showHeatmap && (
        <div className="overflow-x-auto overflow-y-hidden p-2.5 -m-1 animate-in fade-in duration-150">
          {isLoading ? (
            <div className="min-w-[720px] p-2 space-y-1.5 animate-pulse">
              {Array.from({ length: 7 }).map((_, r) => (
                <div key={r} className="h-6 bg-neutral-100 rounded-md w-full" />
              ))}
            </div>
          ) : (
            <div className="min-w-[720px] p-2 space-y-1.5">
              {/* Hours Header */}
              <div className="flex text-[9px] font-mono text-neutral-400 pb-1">
                <div className="w-12 shrink-0 font-bold text-neutral-600">Day</div>
                {Array.from({ length: 24 }).map((_, hr) => (
                  <div key={hr} className="flex-1 text-center">
                    {hr.toString().padStart(2, "0")}
                  </div>
                ))}
              </div>

              {/* 7 Days Rows */}
              {DAYS_OF_WEEK.map((dayName, dayIdx) => (
                <div key={dayName} className="flex items-center">
                  <div className="w-12 shrink-0 text-xs font-bold text-neutral-600">{dayName}</div>
                  <div className="flex-1 flex gap-1">
                    {Array.from({ length: 24 }).map((_, hrIdx) => {
                      const match = heatmapData.find(
                        (cell) => cell.dayOfWeek === dayIdx && cell.hour === hrIdx
                      );
                      const count = match?.count ?? 0;

                      let colorClass = "bg-neutral-100 border-neutral-200 text-neutral-400";
                      if (count > 40) colorClass = "bg-[#8B0000] border-[#8B0000] text-white";
                      else if (count > 25) colorClass = "bg-red-600 border-red-600 text-white";
                      else if (count > 15) colorClass = "bg-red-400 border-red-400 text-white";
                      else if (count > 5) colorClass = "bg-red-200 border-red-300 text-red-900";
                      else if (count > 0) colorClass = "bg-red-50 border-red-200 text-red-800";

                      const cellOrigin = getHeatmapCellOrigin(dayIdx, hrIdx);

                      return (
                        <div
                          key={hrIdx}
                          title={`${dayName} ${hrIdx.toString().padStart(2, "0")}:00 — ${count} logins`}
                          className={`relative flex-1 h-6 rounded-md border text-[9px] font-mono flex items-center justify-center transition-transform duration-150 ease-out hover:scale-125 hover:z-20 hover:shadow-md cursor-pointer select-none ${cellOrigin} ${colorClass}`}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Heatmap intensity legend */}
              <div className="flex items-center justify-end gap-3 pt-3 text-[10px] text-neutral-500 font-medium">
                <span className="font-semibold text-neutral-600">Intensity:</span>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-xs bg-neutral-100 border border-neutral-200" />
                  <span>0</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-xs bg-red-50 border border-red-200" />
                  <span>1-5</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-xs bg-red-200 border border-red-300" />
                  <span>6-15</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-xs bg-red-400 border border-red-400" />
                  <span>16-25</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-xs bg-red-600 border border-red-600" />
                  <span>26-40</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-xs bg-[#8B0000] border border-[#8B0000]" />
                  <span>&gt;40</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
