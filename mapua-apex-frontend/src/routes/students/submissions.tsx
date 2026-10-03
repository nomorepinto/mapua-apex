import { EventSetupForm } from "@/components/students/submissions/event-setup-form"
import {
  SubmissionGuideButton,
  SubmissionGuideDialog,
} from "@/components/students/submissions/submission-guide"
import { SubmissionsStartProvider } from "@/components/students/submissions/submissions-start-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function SubmissionsStart() {
  return (
    <SubmissionsStartProvider>
      <div
        className={cn(
          "relative flex min-h-full flex-col items-center justify-center py-10 sm:py-14",
          layout.page
        )}
      >
        <div className={cn(layout.containerNarrow, layout.stack, "!gap-5")}>
          <EventSetupForm />
          <SubmissionGuideButton />
        </div>
        <SubmissionGuideDialog />
      </div>
    </SubmissionsStartProvider>
  )
}
