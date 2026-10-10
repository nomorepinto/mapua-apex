import { ClockIcon, FileCheck2Icon, HomeIcon } from "lucide-react"
import { Outlet } from "react-router"
import { useAuth } from "react-oidc-context"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { layout } from "@/config"
import { SESSION_LOG_GROUPS, ACTIVITY_LOG_GROUPS } from "@/constants/auth"

export function AdminLayout() {
  const auth = useAuth()
  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const isSessionViewer = userGroups.some((g) =>
    SESSION_LOG_GROUPS.some((target) => g.toLowerCase() === target.toLowerCase())
  )
  const isActivityViewer = userGroups.some((g) =>
    ACTIVITY_LOG_GROUPS.some((target) => g.toLowerCase() === target.toLowerCase())
  )

  const adminNav = [
    {
      label: "Dashboard",
      to: "/admin/dashboard",
      icon: HomeIcon,
      end: true,
    },
    ...(isSessionViewer
      ? [
          {
            label: "Session Log",
            to: "/admin/sessions",
            icon: ClockIcon,
          },
        ]
      : []),
    ...(isActivityViewer
      ? [
          {
            label: "Activity Log",
            to: "/admin/activities",
            icon: FileCheck2Icon,
          },
        ]
      : []),
  ]

  return (
    <AuthGuard allowedGroups={["admin"]}>
      <div className={layout.frame}>
        <AppSidebar
          homeTo="/admin/dashboard"
          items={adminNav}
          panelSwitches={[
            { label: "OSAAR Dashboard", to: "/osaar/dashboard" },
            { label: "Signatory Dashboard", to: "/signatories/dashboard" },
          ]}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
