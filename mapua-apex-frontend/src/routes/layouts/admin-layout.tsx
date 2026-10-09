import {
  ActivityIcon,
  Building2Icon,
  LayoutDashboardIcon,
} from "lucide-react"
import { Outlet } from "react-router"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { layout } from "@/config"

const ADMIN_NAV = [
  {
    label: "Dashboard",
    to: "/admin/dashboard",
    icon: LayoutDashboardIcon,
    end: true,
  },
  {
    label: "Monitor",
    to: "/admin/monitor",
    icon: ActivityIcon,
  },
]

const ADMIN_PANEL_SWITCHES = [
  {
    label: "Switch to OSAAR",
    to: "/osaar/dashboard",
    icon: Building2Icon,
  },
]

export function AdminLayout() {
  return (
    <AuthGuard allowedGroups={["admin"]}>
      <div className={layout.frame}>
        <AppSidebar
          homeTo="/admin/dashboard"
          items={ADMIN_NAV}
          panelSwitches={ADMIN_PANEL_SWITCHES}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
