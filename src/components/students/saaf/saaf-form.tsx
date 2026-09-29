import { useEffect, useRef, type ReactNode } from "react"

import { FieldWarnings } from "@/components/forms/field-warning"
import { FormPageHeader } from "@/components/forms/form-page-header"
import {
  SaafStepper,
  type SaafStepIndex,
} from "@/components/submission/saaf-stepper"
import { saafFieldWarnings } from "@/components/submission/validate-saaf-step"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function SaafForm({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, actions, meta } = useSaafFormContext()
  const FormComponent = meta.Form

  useEffect(() => {
    actions.attachForm(formRef.current)
  }, [actions])

  return (
    <FormComponent
      ref={formRef}
      method="post"
      noValidate
      className={cn(layout.stack, state.showErrors && "saaf-show-errors")}
    >
      <FieldWarnings
        warnings={state.showErrors ? saafFieldWarnings(state.draft) : {}}
      >
        {children}
      </FieldWarnings>
    </FormComponent>
  )
}

export function SaafHeader() {
  const { state } = useSaafFormContext()

  return (
    <FormPageHeader
      title="Student Activity Application Form"
      subtitle={
        state.draft.activityTitle
          ? `${state.draft.activityTitle} · Academic Term 2026–2027`
          : "Academic Term: 2026 - 2027 • Unified Activity Proposal Application"
      }
    />
  )
}

export function SaafStepperControl() {
  const { state, actions } = useSaafFormContext()

  return (
    <SaafStepper
      step={state.step}
      farthestStep={state.farthestStep}
      eventTitle={state.draft.activityTitle}
      onStepSelect={actions.goToStep}
    />
  )
}

export function SaafStepPanel({
  index,
  children,
}: {
  index: SaafStepIndex
  children: ReactNode
}) {
  const { state } = useSaafFormContext()

  return (
    <div
      data-saaf-step={index}
      className={cn(state.step !== index && "hidden")}
      aria-hidden={state.step !== index}
    >
      {children}
    </div>
  )
}
