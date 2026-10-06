import { HomeIcon } from "lucide-react"
import { Outlet } from "react-router"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { layout } from "@/config"

const CDM_REVIEWER_NAV = [
  {
    label: "Dashboard",
    to: "/cdm-reviewer/dashboard",
    icon: HomeIcon,
    end: true,
  },
]

export function CdmReviewerLayout() {
  return (
    <AuthGuard allowedGroups={["admin", "cdm_reviewer"]}>
      <div className={layout.frame}>
        <AppSidebar homeTo="/cdm-reviewer/dashboard" items={CDM_REVIEWER_NAV} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
