import { PostEvalProvider } from "@/components/students/postevals/posteval-context"
import { PostEvalDialogs } from "@/components/students/postevals/posteval-dialogs"
import {
  PostEvalForm,
  PostEvalHeader,
  PostEvalStepperControl,
} from "@/components/students/postevals/posteval-form"
import {
  PostEvalFinancialStep,
  PostEvalParticipationStep,
  PostEvalStepActions,
  PostEvalStepIssueSummary,
  PostEvalSubmitError,
  PostEvalSummaryStep,
} from "@/components/students/postevals/posteval-steps"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function PostEvalWizard() {
  return (
    <PostEvalProvider>
      <div className={cn("relative", layout.page)}>
        <div className={layout.container}>
          <PostEvalForm>
            <PostEvalHeader />
            <PostEvalStepperControl />
            <PostEvalStepIssueSummary />
            <PostEvalSummaryStep />
            <PostEvalFinancialStep />
            <PostEvalParticipationStep />
            <PostEvalSubmitError />
            <PostEvalStepActions />
          </PostEvalForm>
        </div>
        <PostEvalDialogs />
      </div>
    </PostEvalProvider>
  )
}
