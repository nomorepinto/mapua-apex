import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SubmissionCalendarSection } from "@/components/dashboard/submissions/submission-calendar-section"
import { SubmissionTableSection } from "@/components/dashboard/submissions/submission-table-section"
import { useAdminDashboard } from "@/components/admin/dashboard/admin-dashboard-context"
import { useSubmissionView } from "@/lib/dashboard-view"

/**
 * OSAAR's Submissions tab: every submission in the system, shaped like the
 * review desks — a Current + History pair of shared tables in Table view, the
 * shared calendar in Calendar view. Rows open the admin detail dialog (PDF,
 * progress stepper, edit), not the signatory action modal.
 */
export function AdminDashboardSubmissionsPage() {
  const { state, actions } = useAdminDashboard()
  const [view] = useSubmissionView()

  if (view === "calendar") {
    return (
      <SubmissionCalendarSection
        activities={state.activities}
        description="Interactive schedule of student activity submissions with real-time status indicators."
        error={state.submissionsError}
        loading={state.submissionsLoading}
        onSelect={actions.selectActivity}
        title="Applications Calendar"
        toolbar={
          <Button
            size="sm"
            onClick={actions.openCreate}
            className="cursor-pointer gap-1.5 bg-[#8B0000] text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#6e0000] active:scale-95"
            title="Create a new announcement notice"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Create Announcement</span>
          </Button>
        }
        unitLabel="application"
      />
    )
  }

  return (
    <>
      <SubmissionTableSection
        activities={state.currentActivities}
        description="Proposals still moving through the approval chain. Open a row for the full SAAF record; pending and returned papers can be edited from there."
        emptyLabel="No submissions to review yet."
        error={state.submissionsError ? "Could not load submissions." : null}
        loading={state.submissionsLoading}
        onSelect={actions.selectActivity}
        searchLabel="Search submissions"
        statusField="decision"
        statusLabel="Current status"
        title="Current Submissions"
      />
      <SubmissionTableSection
        activities={state.historyActivities}
        description="Every submission that has reached a final outcome across all organizations."
        emptyLabel="No processed submissions yet."
        error={state.submissionsError ? "Could not load submissions." : null}
        loading={state.submissionsLoading}
        onSelect={actions.selectActivity}
        searchLabel="Search history"
        statusField="status"
        statusLabel="Current outcome"
        title="Submission History"
      />
    </>
  )
}
