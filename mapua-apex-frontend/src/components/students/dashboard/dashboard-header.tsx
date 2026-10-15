import { Plus } from "lucide-react"
import { Link } from "react-router"

import { layout } from "@/config"

export function StudentDashboardHeader() {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className={layout.pageTitle}>Student Proposal Dashboard</h1>
        <p className={layout.pageSubtitle}>
          Track your submitted proposals, approvals, and reminders
        </p>
      </div>

      <Link
        to="/students/submissions"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#8B0000] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#6B0000] sm:self-auto cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>Create Proposal</span>
      </Link>
    </div>
  )
}
