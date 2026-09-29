import { SaafDialogs } from "@/components/students/saaf/saaf-dialogs"
import {
  SaafForm,
  SaafHeader,
  SaafStepperControl,
} from "@/components/students/saaf/saaf-form"
import { SaafProvider } from "@/components/students/saaf/saaf-context"
import {
  SaafActivityStep,
  SaafAlignmentStep,
  SaafClassificationStep,
  SaafPeopleStep,
  SaafStepActions,
  SaafSubmitError,
} from "@/components/students/saaf/saaf-steps"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function Submission() {
  return (
    <SaafProvider>
      <div className={cn("relative", layout.page)}>
        <div className={layout.container}>
          <SaafForm>
            <SaafHeader />
            <SaafStepperControl />
            <SaafClassificationStep />
            <SaafPeopleStep />
            <SaafActivityStep />
            <SaafAlignmentStep />
            <SaafSubmitError />
            <SaafStepActions />
          </SaafForm>
        </div>
        <SaafDialogs />
      </div>
    </SaafProvider>
  )
}
