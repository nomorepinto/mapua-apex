import { AnnouncementsPanel } from "@/components/students/dashboard/announcements-panel"
import { StudentDashboardDialogs } from "@/components/students/dashboard/dashboard-dialogs"
import { StudentDashboardHeader } from "@/components/students/dashboard/dashboard-header"
import { RemindersPanel } from "@/components/students/dashboard/reminders-panel"
import { StudentCalendarCard } from "@/components/students/dashboard/student-calendar-card"
import { PostEvalsPanel } from "@/components/students/dashboard/postevals-panel"
import { StudentDashboardProvider } from "@/components/students/dashboard/student-dashboard-context"
import { SubmissionsPanel } from "@/components/students/dashboard/submissions-panel"
import { layout } from "@/config"
import { useCurrentOrganizationQuery } from "@/hooks/use-submissions"
import { cn } from "@/lib/utils"

export function OrgDashboard() {
  const organizationQuery = useCurrentOrganizationQuery()
  const showPostEvals =
    !organizationQuery.isPending &&
    organizationQuery.data?.is_higher_council !== true

  return (
    <StudentDashboardProvider>
      <div className={cn(layout.page, layout.stack, "!gap-6")}>
        {/* 1. Header: Title, Subtitle, Create Proposal button */}
        <StudentDashboardHeader />

        {/* 2. Full-width Card: My Proposal Submissions */}
        <SubmissionsPanel />

        {/* 3. Two columns below:
               - Left (wider): Calendar card with OSAAR styling
               - Right (narrower): Stacked Student Announcements & Timeline Reminders */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 xl:col-span-8">
            <StudentCalendarCard />
          </div>
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
            <AnnouncementsPanel />
            <RemindersPanel />
          </div>
        </div>

        {/* 4. Full-width Card: Post-Evaluation Forms */}
        {showPostEvals ? <PostEvalsPanel /> : null}

        {/* Modals & Dialogs (Submission tracker, review notices, etc.) */}
        <StudentDashboardDialogs />
      </div>
    </StudentDashboardProvider>
  )
}
