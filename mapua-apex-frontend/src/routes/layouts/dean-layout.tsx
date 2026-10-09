import { HomeIcon } from "lucide-react"
import { Outlet } from "react-router"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { layout } from "@/config"

const DEAN_NAV = [
  {
    label: "Dashboard",
    to: "/dean/dashboard",
    icon: HomeIcon,
    end: true,
  },
]

export function DeanLayout() {
  return (
    <AuthGuard allowedGroups={["admin", "dean"]}>
      <div className={layout.frame}>
        <AppSidebar homeTo="/dean/dashboard" items={DEAN_NAV} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
