import { useEffect, useRef, type ReactNode } from "react"

import { FormPageHeader } from "@/components/forms/form-page-header"
import type { PostEvalStepIndex } from "@/components/posteval/constants"
import { PostEvalStepper } from "@/components/posteval/posteval-stepper"
import { usePostEvalFormContext } from "@/components/students/postevals/posteval-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

/**
 * The wizard's real <form>. Submitting posts to this route's action, which reads
 * the persisted draft from the org store (not the form body), so the fields here
 * exist for structure/keyboard semantics rather than payload assembly.
 */
export function PostEvalForm({ children }: { children: ReactNode }) {
  const formRef = useRef<HTMLFormElement>(null)
  const { actions, meta } = usePostEvalFormContext()
  const FormComponent = meta.Form

  useEffect(() => {
    actions.attachForm(formRef.current)
  }, [actions])

  return (
    <FormComponent ref={formRef} method="post" noValidate className={layout.stack}>
      {children}
    </FormComponent>
  )
}

export function PostEvalHeader() {
  const { state } = usePostEvalFormContext()

  return (
    <FormPageHeader
      title="Post-Evaluation"
      subtitle={
        state.draft.eventTitle || "Report how your approved event went"
      }
    />
  )
}

export function PostEvalStepperControl() {
  const { state, actions } = usePostEvalFormContext()

  return (
    <PostEvalStepper
      step={state.step}
      farthestStep={state.farthestStep}
      eventTitle={state.draft.eventTitle}
      onStepSelect={actions.goToStep}
    />
  )
}

export function PostEvalStepPanel({
  index,
  children,
}: {
  index: PostEvalStepIndex
  children: ReactNode
}) {
  const { state } = usePostEvalFormContext()

  return (
    <div
      data-posteval-step={index}
      className={cn(state.step !== index && "hidden")}
      aria-hidden={state.step !== index}
    >
      {children}
    </div>
  )
}
