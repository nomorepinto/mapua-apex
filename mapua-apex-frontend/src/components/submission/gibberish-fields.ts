import type { PostEvalDraft } from "@/components/posteval/types"
import type { ReservationDraft } from "@/components/reservation/types"
import type { GibberishField } from "@/hooks/use-gibberish-check"

import type { SaafDraft } from "./types"

/**
 * The free-text fields the gibberish detector covers, grouped by the wizard step
 * that renders them.
 *
 * Why a declarative inventory instead of per-field hooks: most of these inputs are
 * rendered inside `.map()` loops — one card per room, per proponent, per budget
 * line — and a hook cannot be called in a loop. A step instead checks its whole
 * group when Continue is pressed, which also means a field that was never blurred
 * still cannot slip through.
 *
 * The step numbers mirror STEP_PREFIXES_WITH_RESERVATION / STEP_PREFIXES_NO_RESERVATION
 * in validate-saaf-step.ts: adding a reservation step pushes activity details to 3 and
 * institutional alignment to 4.
 *
 * Proponent names, organization names and departments are deliberately absent — they
 * are legitimately acronym-shaped, so the detector would reject valid input.
 */
function proponentFields(draft: SaafDraft): GibberishField[] {
  return draft.proponents.flatMap((proponent, index) => {
    const who = `Proponent ${index + 1}`
    return [
      {
        label: `${who} · Position of the applicant`,
        value: proponent.positionOfApplicant,
      },
      { label: `${who} · Program / year level`, value: proponent.programAndYear },
    ]
  })
}

function activityFields(draft: SaafDraft): GibberishField[] {
  return [
    { label: "Title of activity", value: draft.activityTitle },
    { label: "Description", value: draft.activityDescription },
    { label: "Objectives of the activity", value: draft.activityObjectives },
  ]
}

function budgetFields(draft: SaafDraft): GibberishField[] {
  return draft.budgetItems.map((item, index) => ({
    label: `Budget item ${index + 1} · Item`,
    value: item.item,
  }))
}

function alignmentFields(draft: SaafDraft): GibberishField[] {
  return [
    { label: "Core values explanation", value: draft.coreValuesExplanation },
    { label: "Program educational objectives", value: draft.peoExplanation },
    { label: "UN sustainability goals", value: draft.sdgExplanation },
  ]
}

/**
 * Every purpose note on the reservation step — one per picked room and per picked
 * piece of equipment, each with its own label so the issue list names the offender.
 */
export function reservationGibberishFields(
  reservationDraft?: ReservationDraft | null
): GibberishField[] {
  return (reservationDraft?.picks ?? []).map((pick) => ({
    label: `${pick.name} · ${
      pick.type === "equipment" ? "Equipment Remark / Purpose" : "Reservation Purpose"
    }`,
    value: pick.remarks,
  }))
}

/** Text fields owned by one wizard step, checked when the user leaves that step. */
export function saafStepGibberishFields(
  step: number,
  draft: SaafDraft,
  includeReservation: boolean,
  reservationDraft?: ReservationDraft | null
): GibberishField[] {
  if (includeReservation && step === 2) {
    return reservationGibberishFields(reservationDraft)
  }

  const detailsStep = includeReservation ? 3 : 2
  const alignmentStep = includeReservation ? 4 : 3

  if (step === 1) return proponentFields(draft)
  if (step === detailsStep) return activityFields(draft)
  // SaafAlignmentStep renders the alignment section and the budget table together.
  if (step === alignmentStep) return [...alignmentFields(draft), ...budgetFields(draft)]

  return []
}

/** Everything in scope, for the final submit pass across all steps. */
export function saafAllGibberishFields(
  draft: SaafDraft,
  includeReservation: boolean,
  reservationDraft?: ReservationDraft | null
): GibberishField[] {
  return [
    ...proponentFields(draft),
    ...activityFields(draft),
    ...budgetFields(draft),
    ...alignmentFields(draft),
    ...(includeReservation ? reservationGibberishFields(reservationDraft) : []),
  ]
}

/**
 * Post-evaluation wizard. Step 0 is the event summary, step 1 the financial report;
 * only expenses added during the post-eval are typed by hand, since the budget lines
 * are seeded read-only from the original submission.
 */
export function postEvalStepGibberishFields(
  step: number,
  draft: PostEvalDraft
): GibberishField[] {
  if (step === 0) return [{ label: "Event summary", value: draft.summary }]
  if (step === 1) {
    return (draft.financialReport?.addedItems ?? []).map((item, index) => ({
      label: `Added item ${index + 1} · Item`,
      value: item.item,
    }))
  }
  return []
}

/** Every post-eval text field, for the final submit pass. */
export function postEvalAllGibberishFields(draft: PostEvalDraft): GibberishField[] {
  return [
    ...postEvalStepGibberishFields(0, draft),
    ...postEvalStepGibberishFields(1, draft),
  ]
}
