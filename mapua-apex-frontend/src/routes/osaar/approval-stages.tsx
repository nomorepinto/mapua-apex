import { ApprovalStagesCard } from "@/components/admin/approval-stages/approval-stages-card"
import { ApprovalStagesLoadAlert } from "@/components/admin/approval-stages/approval-stages-load-alert"
import { ApprovalStagesProvider } from "@/components/admin/approval-stages/approval-stages-context"

export function AdminApprovalStagesPage() {
  return (
    <ApprovalStagesProvider>
      <ApprovalStagesLoadAlert />
      <ApprovalStagesCard />
    </ApprovalStagesProvider>
  )
}
