import { AnnouncementsPanel } from "@/components/students/dashboard/announcements-panel"
import { StudentDashboardDialogs } from "@/components/students/dashboard/dashboard-dialogs"
import { StudentDashboardHeader } from "@/components/students/dashboard/dashboard-header"
import { RemindersPanel } from "@/components/students/dashboard/reminders-panel"
import { StudentDashboardProvider } from "@/components/students/dashboard/student-dashboard-context"
import { SubmissionsPanel } from "@/components/students/dashboard/submissions-panel"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function OrgDashboard() {
  return (
    <StudentDashboardProvider>
      <div className={cn(layout.page, layout.stack)}>
        <StudentDashboardHeader />
        <div className={cn(layout.grid3, layout.gap)}>
          <div className={cn("xl:col-span-2", layout.stack)}>
            <SubmissionsPanel />
            <AnnouncementsPanel />
          </div>
          <div className={cn("xl:col-span-1", layout.stack)}>
            <RemindersPanel />
          </div>
        </div>
        <StudentDashboardDialogs />
      </div>
    </StudentDashboardProvider>
  )
}
