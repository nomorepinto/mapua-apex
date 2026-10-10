import { HomeIcon } from "lucide-react"
import { Outlet } from "react-router"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { layout } from "@/config"

const ORG_ADVISER_NAV = [
  {
    label: "Dashboard",
    to: "/adviser/dashboard",
    icon: HomeIcon,
    end: true,
  },
]

export function OrgAdviserLayout() {
  return (
    <AuthGuard allowedGroups={["admin", "org_adviser"]}>
      <div className={layout.frame}>
        <AppSidebar homeTo="/adviser/dashboard" items={ORG_ADVISER_NAV} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
