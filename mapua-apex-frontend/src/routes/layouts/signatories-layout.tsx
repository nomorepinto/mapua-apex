import { FileCheck2Icon, HomeIcon } from "lucide-react"
import { Outlet } from "react-router"
import { useAuth } from "react-oidc-context"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { layout } from "@/config"
import { ACTIVITY_LOG_GROUPS } from "@/constants/auth"

export function SignatoriesLayout() {
  const auth = useAuth()
  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const hasActivityAccess = userGroups.some((g) =>
    ACTIVITY_LOG_GROUPS.some((target) => g.toLowerCase() === target.toLowerCase())
  )

  const signatoryNav = [
    {
      label: "Dashboard",
      to: "/signatories/dashboard",
      icon: HomeIcon,
      end: true,
    },
    ...(hasActivityAccess
      ? [
          {
            label: "Activity Log",
            to: "/signatories/activities",
            icon: FileCheck2Icon,
          },
        ]
      : []),
  ]

  return (
    <AuthGuard allowedGroups={["admin", "osaar", "cdm_reviewer", "cdm", "org_adviser", "dean"]}>
      <div className={layout.frame}>
        <AppSidebar
          homeTo="/signatories/dashboard"
          items={signatoryNav}
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
