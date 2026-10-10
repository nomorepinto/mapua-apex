import { BoxesIcon, FileCheck2Icon, HomeIcon } from "lucide-react"
import { Outlet } from "react-router"
import { useAuth } from "react-oidc-context"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { layout } from "@/config"
import { ACTIVITY_LOG_GROUPS } from "@/constants/auth"

export function CdmReviewerLayout() {
  const auth = useAuth()
  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const hasActivityAccess = userGroups.some((g) =>
    ACTIVITY_LOG_GROUPS.some((target) => g.toLowerCase() === target.toLowerCase())
  )

  const cdmNav = [
    {
      label: "Dashboard",
      to: "/cdm/dashboard",
      icon: HomeIcon,
      end: true,
    },
    {
      label: "Reservables",
      to: "/cdm/reservables",
      icon: BoxesIcon,
    },
    ...(hasActivityAccess
      ? [
          {
            label: "Activity Log",
            to: "/cdm/activities",
            icon: FileCheck2Icon,
          },
        ]
      : []),
  ]

  return (
    <AuthGuard allowedGroups={["admin", "cdm_reviewer", "cdm"]}>
      <div className={layout.frame}>
        <AppSidebar homeTo="/cdm/dashboard" items={cdmNav} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </AuthGuard>
  )
}
