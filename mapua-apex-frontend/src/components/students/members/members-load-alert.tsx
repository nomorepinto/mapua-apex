import { CircleAlertIcon } from "lucide-react"

import { useMembersPage } from "@/components/students/members/members-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function MembersLoadAlert() {
  const { state } = useMembersPage()
  if (!state.loadError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Could not load members</AlertTitle>
      <AlertDescription>{state.loadError}</AlertDescription>
    </Alert>
  )
}
