import { CircleAlertIcon } from "lucide-react"

import { useApprovalStagesPage } from "@/components/admin/approval-stages/approval-stages-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ApprovalStagesLoadAlert() {
  const { state } = useApprovalStagesPage()
  if (!state.loadError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Could not load approval stages</AlertTitle>
      <AlertDescription>{state.loadError}</AlertDescription>
    </Alert>
  )
}
