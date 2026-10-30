import { EventPickerForm } from "@/components/students/postevals/event-picker-form"
import {
  PostEvalGuideButton,
  PostEvalGuideDialog,
} from "@/components/students/postevals/posteval-guide"
import { PostEvalOrganizationGate } from "@/components/students/postevals/posteval-organization-gate"
import { PostEvalsStartProvider } from "@/components/students/postevals/postevals-start-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function PostEvalsStart() {
  return (
    <PostEvalOrganizationGate>
      <PostEvalsStartProvider>
        <div
          className={cn(
            "relative flex min-h-full flex-col items-center justify-center py-10 sm:py-14",
            layout.page
          )}
        >
          <div className={cn(layout.containerNarrow, layout.stack, "!gap-5")}>
            <EventPickerForm />
            <PostEvalGuideButton />
          </div>
          <PostEvalGuideDialog />
        </div>
      </PostEvalsStartProvider>
    </PostEvalOrganizationGate>
  )
}
