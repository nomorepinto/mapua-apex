import {
  CalendarIcon,
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
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/admin/reservables/segmented-control"
import { FormPageHeader } from "@/components/forms/form-page-header"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

type DashboardSection =
  | "review"
  | "calendar"
  | "submissions"
  | "announcements"

const SECTION_ITEMS: SegmentedItem<DashboardSection>[] = [
  { value: "review", label: "Review", icon: ClipboardCheckIcon },
  {
    value: "calendar",
    label: "All submissions calendar",
    icon: CalendarIcon,
  },
  { value: "submissions", label: "All submissions", icon: FileTextIcon },
  { value: "announcements", label: "Announcements", icon: MegaphoneIcon },
]

function resolveSection(pathname: string): DashboardSection {
  const segment = pathname.split("/").filter(Boolean).pop()
  return SECTION_ITEMS.some((item) => item.value === segment)
    ? (segment as DashboardSection)
    : "review"
}

export function OsaarDashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const section = resolveSection(location.pathname)

  return (
    <AdminDashboardProvider>
      <div className={layout.page}>
        <div className={cn(layout.container, layout.stack)}>
          <FormPageHeader
            subtitle="Approve proposals waiting in the review queue, browse every submission on the calendar and in the full list, and post announcements across every organization."
            title="Dashboard"
          />
          <SegmentedControl
            ariaLabel="Dashboard section"
            className="max-w-full flex-wrap"
            items={SECTION_ITEMS}
            mode="tablist"
            onChange={(value) => navigate(`/osaar/dashboard/${value}`)}
            value={section}
          />
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
