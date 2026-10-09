import { AdminAnnouncementsSection } from "@/components/admin/dashboard/announcements-section"
import { AdminDashboardHeader } from "@/components/admin/dashboard/admin-dashboard-header"
import { AdminDashboardProvider } from "@/components/admin/dashboard/admin-dashboard-context"
import {
  CreateAnnouncementDialog,
  DeleteAnnouncementDialog,
  EditAnnouncementDialog,
  SubmissionDetailDialog,
} from "@/components/admin/dashboard/announcement-dialogs"
import { AdminSubmissionsSection } from "@/components/admin/dashboard/submissions-section"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminOsaPanel() {
  return (
    <AdminDashboardProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <AdminDashboardHeader />
          <AdminSubmissionsSection />
          <AdminAnnouncementsSection />
        </div>
        <SubmissionDetailDialog />
        <CreateAnnouncementDialog />
        <EditAnnouncementDialog />
        <DeleteAnnouncementDialog />
      </div>
    </AdminDashboardProvider>
  )
}
