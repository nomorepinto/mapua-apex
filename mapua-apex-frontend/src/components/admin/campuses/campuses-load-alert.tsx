import { CircleAlertIcon } from "lucide-react"

import { useCampusesPage } from "@/components/admin/campuses/campuses-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function CampusesLoadAlert() {
  const { state } = useCampusesPage()
  if (!state.loadError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Could not load campuses</AlertTitle>
      <AlertDescription>{state.loadError}</AlertDescription>
    </Alert>
  )
}

export function MainCampusAlert() {
  const { state } = useCampusesPage()
  if (state.loading || state.loadError || state.hasMain) return null

  return (
    <Alert variant="warning">
      <CircleAlertIcon />
      <AlertTitle>No main campus</AlertTitle>
      <AlertDescription>
        Online events cannot be sent until one campus is the main campus.
      </AlertDescription>
    </Alert>
  )
}
