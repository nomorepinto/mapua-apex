import { useEffect, useRef, type ReactNode } from "react"

import { FieldWarnings } from "@/components/forms/field-warning"
import { FormPageHeader } from "@/components/forms/form-page-header"
import {
  SaafStepper,
  type WizardStepIndex,
} from "@/components/submission/saaf-stepper"
import { saafFieldWarnings } from "@/components/submission/validate-saaf-step"
import { useSaafFormContext } from "@/components/students/saaf/saaf-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

/**
 * Maps a blurred control to its `saafFieldWarnings` key. Native inputs and
 * textareas carry a `name` equal to the warning key, except proponent fields,
 * which are indexed (`proponent_0_studentNumber`) and resolve to the id-based
 * key (`proponent.<id>.studentNumber`). Returns null for nameless controls
 * (Select triggers, buttons), which are simply not tracked for blur errors.
 */
function touchedKeyFromTarget(
  target: EventTarget | null,
  proponents: Array<{ id: string }>
): string | null {
  if (!(target instanceof HTMLElement)) return null
  const name = (target as HTMLInputElement).name
  if (!name) return null
  const match = /^proponent_(\d+)_(.+)$/.exec(name)
  if (match) {
    const id = proponents[Number(match[1])]?.id
    return id ? `proponent.${id}.${match[2]}` : null
  }
  return name
}

export function SaafForm({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { state, actions, meta } = useSaafFormContext()
  const FormComponent = meta.Form

  useEffect(() => {
    actions.attachForm(formRef.current)
  }, [actions])

  // Inline errors surface per field once the user has left it with an invalid
  // value; a failed Continue/Submit (`showErrors`) still reveals every warning.
  const allWarnings = saafFieldWarnings(state.draft)
  const warnings = state.showErrors
    ? allWarnings
    : Object.fromEntries(
        Object.entries(allWarnings).filter(([key]) => state.touched[key])
      )

  return (
    <FormComponent
      ref={formRef}
      method="post"
      noValidate
      onBlur={(event) => {
        const key = touchedKeyFromTarget(event.target, state.draft.proponents)
        if (key) actions.markTouched(key)
      }}
      className={cn(layout.stack, state.showErrors && "saaf-show-errors")}
    >
      <FieldWarnings warnings={warnings}>{children}</FieldWarnings>
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
      includeReservation={state.includeReservation}
      onStepSelect={actions.goToStep}
    />
  )
}

export function SaafStepPanel({
  index,
  children,
}: {
  index: WizardStepIndex
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
