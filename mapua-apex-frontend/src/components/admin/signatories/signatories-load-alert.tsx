import { CircleAlertIcon } from "lucide-react"

import { useSignatoriesPage } from "@/components/admin/signatories/signatories-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function SignatoriesLoadAlert() {
  const { state } = useSignatoriesPage()
  if (!state.loadError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Could not load signatories</AlertTitle>
      <AlertDescription>{state.loadError}</AlertDescription>
    </Alert>
  )
}
