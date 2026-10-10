import { SaafDialogs } from "@/components/students/saaf/saaf-dialogs"
import {
  SaafForm,
  SaafHeader,
  SaafStepperControl,
} from "@/components/students/saaf/saaf-form"
import { SaafProvider } from "@/components/students/saaf/saaf-context"
import { ReservationProvider } from "@/components/students/reservations/reservation-context"
import {
  SaafActivityStep,
  SaafAlignmentStep,
  SaafClassificationStep,
  SaafPeopleStep,
  SaafReservationStep,
  SaafStepActions,
  SaafStepIssueSummary,
  SaafSubmitError,
} from "@/components/students/saaf/saaf-steps"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function Submission() {
  return (
    <SaafProvider>
      <ReservationProvider>
        <div className={cn("relative", layout.page)}>
          <div className={layout.container}>
            <SaafForm>
              <SaafHeader />
              <SaafStepperControl />
              <SaafStepIssueSummary />
              <SaafClassificationStep />
              <SaafPeopleStep />
              <SaafActivityStep />
              <SaafAlignmentStep />
              <SaafReservationStep />
              <SaafSubmitError />
              <SaafStepActions />
            </SaafForm>
          </div>
          <SaafDialogs />
        </div>
      </ReservationProvider>
    </SaafProvider>
  )
}
