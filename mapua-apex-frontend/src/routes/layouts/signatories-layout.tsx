import { HomeIcon } from "lucide-react"
import { Outlet } from "react-router"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { layout } from "@/config"

const SIGNATORY_NAV = [
  {
    label: "Dashboard",
    to: "/signatories/dashboard",
    icon: HomeIcon,
    end: true,
  },
]

export function SignatoriesLayout() {
  return (
    <AuthGuard allowedGroups={["admin", "osaar", "cdm_reviewer", "org_adviser", "dean"]}>
      <div className={layout.frame}>
        <AppSidebar
          homeTo="/signatories/dashboard"
          items={SIGNATORY_NAV}
          switchPanelLabel="Admin Dashboard"
          switchPanelTo="/admin/dashboard"
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
