import { ArrowUp } from "lucide-react"

import { AdminAnnouncementsSection } from "@/components/admin/dashboard/announcements-section"
import { AdminCalendarSection } from "@/components/admin/dashboard/calendar-section"
import { AdminDashboardHeader } from "@/components/admin/dashboard/admin-dashboard-header"
import { AdminDashboardProvider } from "@/components/admin/dashboard/admin-dashboard-context"
import { AdminNavigationPanel } from "@/components/admin/dashboard/admin-navigation-panel"
import {
  CreateAnnouncementDialog,
  DeleteAnnouncementDialog,
  EditAnnouncementDialog,
  SubmissionDetailDialog,
} from "@/components/admin/dashboard/announcement-dialogs"
import { AdminSubmissionsSection } from "@/components/admin/dashboard/submissions-section"
import { Button } from "@/components/ui/button"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AdminDashboard() {
  const scrollToTop = () => {
    const topEl = document.getElementById("admin-dashboard-top")
    if (topEl) {
      topEl.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    const main = document.querySelector("main")
    if (main) {
      main.scrollTo({ top: 0, behavior: "smooth" })
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <AdminDashboardProvider>
      <div className={layout.page}>
        <div id="admin-dashboard-top" className={cn(layout.container, layout.stack, "scroll-mt-4")}>
          <AdminDashboardHeader />
          <AdminNavigationPanel />
          <AdminCalendarSection />
          <AdminSubmissionsSection />
          <AdminAnnouncementsSection />

          {/* Back to Top Navigation Action */}
          <div className="flex flex-col items-center justify-center pt-2 pb-10 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToTop}
              className="group inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white/90 px-5 py-2 text-xs font-bold text-neutral-700 shadow-2xs hover:border-[#8B0000]/40 hover:bg-neutral-50 hover:text-[#8B0000] transition-all cursor-pointer hover:shadow-xs active:scale-95"
              aria-label="Back to top of page"
            >
              <ArrowUp className="h-3.5 w-3.5 text-[#8B0000] transition-transform group-hover:-translate-y-0.5" />
              <span>Back to top</span>
            </Button>
            <p className="text-[11px] font-medium text-neutral-400">
              Office of Student Affairs · Mapúa University
            </p>
          </div>
        </div>
        <SubmissionDetailDialog />
        <CreateAnnouncementDialog />
        <EditAnnouncementDialog />
        <DeleteAnnouncementDialog />
      </div>
    </AdminDashboardProvider>
  )
}
