import { ArrowUpRight } from "lucide-react"
import { Link } from "react-router"

import { useStudentDashboard } from "@/components/students/dashboard/student-dashboard-context"
import { layout } from "@/config"

export function StudentDashboardHeader() {
  const { state } = useStudentDashboard()

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className={layout.pageTitle}>{state.organizationName} Dashboard</h1>
        <p className={layout.pageSubtitle}>
          Track proposals, then catch announcements and reminders
        </p>
      </div>

      <Link
        to="/students/submissions"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#8B0000] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#6B0000] sm:self-auto"
      >
        <span>Create Project/Event</span>
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
