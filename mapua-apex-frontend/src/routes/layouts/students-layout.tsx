import { ClipboardListIcon, HomeIcon, PlusCircleIcon, UsersIcon, WrenchIcon } from "lucide-react"
import { Outlet } from "react-router"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { layout } from "@/config"
import { useCurrentOrganizationQuery } from "@/hooks/use-submissions"

const STUDENT_NAV = [
  {
    label: "Dashboard",
    to: "/students/dashboard",
    icon: HomeIcon,
    end: true,
  },
  {
    label: "New proposal",
    to: "/students/submissions",
    icon: PlusCircleIcon,
  },
  {
    label: "Post-evals",
    to: "/students/postevals",
    icon: ClipboardListIcon,
  },
  {
    label: "Members",
    to: "/students/members",
    icon: UsersIcon,
  },
  {
    label: "Tools",
    to: "/students/tools",
    icon: WrenchIcon,
  },
]

export function StudentsLayout() {
  return (
    <AuthGuard allowedGroups={["admin", "org_adviser", "org_submitter", "student"]}>
      <StudentsFrame />
    </AuthGuard>
  )
}

function StudentsFrame() {
  const organizationQuery = useCurrentOrganizationQuery()
  const items =
    organizationQuery.data?.is_higher_council === true
      ? STUDENT_NAV.filter((item) => item.to !== "/students/postevals")
      : STUDENT_NAV

  return (
    <div className={layout.frame}>
      <AppSidebar homeTo="/students/dashboard" items={items} />
      <main className={layout.main}>
        <Outlet />
      </main>
    </div>
  )
}
