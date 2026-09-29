import { CircleAlertIcon } from "lucide-react"

import { useOrganizationsPage } from "@/components/admin/organizations/organizations-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function OrganizationsLoadAlert() {
  const { state } = useOrganizationsPage()
  if (!state.loadError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Could not load directory</AlertTitle>
      <AlertDescription>{state.loadError}</AlertDescription>
    </Alert>
  )
}
