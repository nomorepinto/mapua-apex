import { AlertTriangle, CheckCircle, Volume2 } from "lucide-react"

import { formatRelativeTime } from "@/lib/progress-color"
import type { ActivityLog } from "@/stores/org-store"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

const ACTIVITY_STYLES = {
  success: {
    Icon: CheckCircle,
    iconBg: "bg-[#ECFDF5]",
    iconColor: "text-[#10B981]",
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: "bg-[#FFFBEB]",
    iconColor: "text-[#F59E0B]",
  },
  error: {
    Icon: Volume2,
    iconBg: "bg-[#FEF2F2]",
    iconColor: "text-[#D9291C]",
  },
  info: {
    Icon: CheckCircle,
    iconBg: "bg-[#ECFDF5]",
    iconColor: "text-[#10B981]",
  },
} as const

export function RecentActivities({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className={cn(layout.section, "xl:col-span-1")}>
      <h2 className="mb-4 text-xl font-bold text-[#1E293B]">Recent Activities</h2>

      <div className="flex flex-col gap-3">
        {activities.length === 0 ? (
          <p className="text-xs text-neutral-600 italic">No recent activities.</p>
        ) : (
          activities.slice(0, 5).map((activity) => {
            const style = ACTIVITY_STYLES[activity.type]
            const Icon = style.Icon

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-xl border border-neutral-100/80 bg-[#F8FAFC] p-4"
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.iconBg} ${style.iconColor}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="w-full min-w-0">
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="text-xs leading-snug font-bold text-[#1E293B] sm:text-sm">
                      {activity.title}
                    </h4>
                    <span className="ml-2 shrink-0 text-[10px] text-neutral-600 sm:text-xs">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#64748B]">
                    {activity.description}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
