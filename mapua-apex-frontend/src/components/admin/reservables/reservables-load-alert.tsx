import { CircleAlertIcon } from "lucide-react"

import { useReservablesPage } from "@/components/admin/reservables/reservables-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ReservablesLoadAlert() {
  const { state } = useReservablesPage()
  if (!state.loadError) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Could not load reservables</AlertTitle>
      <AlertDescription>{state.loadError}</AlertDescription>
    </Alert>
  )
}
