import { layout } from "@/config"

export function AdminDashboardHeader() {
  return (
    <div>
      <h1 className={layout.pageTitle}>
        Admin Panel — Office of Student Affairs
      </h1>
      <p className={layout.pageSubtitle}>
        Global submissions and announcements across every organization.
      </p>
    </div>
  )
}
