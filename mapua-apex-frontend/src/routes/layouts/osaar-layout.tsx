import { ClipboardListIcon, FileCheck2Icon, HomeIcon, Settings2Icon } from "lucide-react"
import { Outlet } from "react-router"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { layout } from "@/config"

const OSAAR_NAV = [
  {
    label: "Dashboard",
    to: "/osaar/dashboard",
    icon: HomeIcon,
  },
  {
    label: "Setup",
    to: "/osaar/setup",
    icon: Settings2Icon,
  },
  {
    label: "Post-evals",
    to: "/osaar/postevals",
    icon: ClipboardListIcon,
  },
  {
    label: "Activity Log",
    to: "/osaar/activities",
    icon: FileCheck2Icon,
  },
]

export function OsaarLayout() {
  return (
    <AuthGuard allowedGroups={["admin", "osaar"]}>
      <div className={layout.frame}>
        <AppSidebar homeTo="/osaar/dashboard" items={OSAAR_NAV} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
