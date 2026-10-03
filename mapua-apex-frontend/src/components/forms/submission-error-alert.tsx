import { CircleAlertIcon } from "lucide-react"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

export function SubmissionErrorAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null

  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>Submission failed</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
