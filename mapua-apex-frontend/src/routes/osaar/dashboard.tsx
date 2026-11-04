import {
  ClipboardCheckIcon,
  FileTextIcon,
  MegaphoneIcon,
} from "lucide-react"
import { Outlet, useLocation, useNavigate } from "react-router"

import {
  CreateAnnouncementDialog,
  DeleteAnnouncementDialog,
  EditAnnouncementDialog,
  SubmissionDetailDialog,
} from "@/components/admin/dashboard/announcement-dialogs"
import { AdminDashboardProvider } from "@/components/admin/dashboard/admin-dashboard-context"
import { EditSubmissionDialog } from "@/components/admin/dashboard/edit-submission-dialog"
import { SubmissionViewSwitch } from "@/components/dashboard/submissions/submission-desk"
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/admin/reservables/segmented-control"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { submissionViewSearch, useSubmissionView } from "@/lib/dashboard-view"
import { cn } from "@/lib/utils"

type DashboardSection = "review" | "submissions" | "announcements"

const SECTION_ITEMS: SegmentedItem<DashboardSection>[] = [
  { value: "review", label: "Review", icon: ClipboardCheckIcon },
  { value: "submissions", label: "Submissions", icon: FileTextIcon },
  { value: "announcements", label: "Announcements", icon: MegaphoneIcon },
]

/** Sections that offer the Table | Calendar view switch below the tab bar. */
const VIEW_SECTIONS: DashboardSection[] = ["review", "submissions"]

function resolveSection(pathname: string): DashboardSection {
  const segment = pathname.split("/").filter(Boolean).pop()
  return SECTION_ITEMS.some((item) => item.value === segment)
    ? (segment as DashboardSection)
    : "review"
}

export function OsaarDashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [view] = useSubmissionView()
  const section = resolveSection(location.pathname)

  return (
    <AdminDashboardProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <FormPageHeader
            subtitle="Approve proposals waiting in the review queue, browse every submission and posted announcement, and switch either list to its calendar view."
            title="Dashboard"
          />
          <SegmentedControl
            ariaLabel="Dashboard section"
            className="max-w-full flex-wrap"
            items={SECTION_ITEMS}
            mode="tablist"
            onChange={(value) =>
              navigate(
                `/osaar/dashboard/${value}${
                  VIEW_SECTIONS.includes(value)
                    ? submissionViewSearch(view)
                    : ""
                }`
              )
            }
            value={section}
          />
          {VIEW_SECTIONS.includes(section) ? <SubmissionViewSwitch /> : null}
          <Outlet />
        </div>
        <SubmissionDetailDialog />
        <EditSubmissionDialog />
        <CreateAnnouncementDialog />
        <EditAnnouncementDialog />
        <DeleteAnnouncementDialog />
      </div>
    </AdminDashboardProvider>
  )
}
