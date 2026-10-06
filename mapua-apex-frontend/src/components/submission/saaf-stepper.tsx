import { layout } from "@/config"
import { cn } from "@/lib/utils"

export const SAAF_STEPS = [
  { id: "classification", label: "Classification" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
  { id: "alignment", label: "Alignment & budget" },
] as const

export const RESERVATION_STEP = { id: "reservation", label: "Reservation" }

/** Step indices for the four SAAF panels (used by the SAAF validation maps). */
export type SaafStepIndex = 0 | 1 | 2 | 3

/** Step indices for the whole wizard, including the optional reservation step. */
export type WizardStepIndex = 0 | 1 | 2 | 3 | 4

export function SaafStepper({
  step,
  farthestStep,
  eventTitle,
  includeReservation,
  onStepSelect,
}: {
  step: WizardStepIndex
  farthestStep: WizardStepIndex
  eventTitle?: string
  includeReservation: boolean
  onStepSelect: (step: WizardStepIndex) => void
}) {
  const steps = includeReservation
    ? [...SAAF_STEPS, RESERVATION_STEP]
    : [...SAAF_STEPS]
  // The list shrinks when the reservation step is dropped, so an out-of-range
  // index must clamp instead of reading past the end.
  const activeStep = Math.min(step, steps.length - 1)

  // Per-step display state, shared by the mobile ball rail and the desktop
  // cards so the two layouts stay in lockstep.
  const stepStates = steps.map((item, index) => {
    const active = index === activeStep
    const reached = index <= farthestStep
    const done = reached && !active
    return { item, index, active, done, clickable: done }
  })

  return (
    <div className="space-y-3">
      {eventTitle ? (
        <p className="text-sm font-semibold text-neutral-800">{eventTitle}</p>
      ) : null}

      {/* Mobile: a centered progress rail of numbered balls joined by a line
          that fills as steps are reached. The step name lives in the caption
          below, so the balls stay compact while keeping the same tap-to-jump
          behavior as the desktop cards. */}
      <ol className="flex items-center sm:hidden">
        {stepStates.map(({ item, index, active, done, clickable }) => (
          <li
            key={item.id}
            className={cn("flex items-center", index > 0 && "flex-1")}
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index <= farthestStep ? "bg-[#8B0000]" : "bg-neutral-200"
                )}
              />
            )}
            <StepBall
              index={index}
              active={active}
              done={done}
              clickable={clickable}
              label={item.label}
              onSelect={onStepSelect}
            />
          </li>
        ))}
      </ol>

      {/* From `sm` up: the labelled cards. */}
      <ol
        className={cn(
          "hidden gap-2 sm:grid",
          includeReservation ? "sm:grid-cols-5" : "sm:grid-cols-4"
        )}
      >
        {stepStates.map(({ item, index, active, done, clickable }) => {
          const className = cn(
            "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left",
            active && "border-[#8B0000] bg-[#8B0000] text-white",
            done &&
              "cursor-pointer border-[#8B0000]/30 bg-[#8B0000]/5 text-[#8B0000] transition-colors hover:border-[#8B0000]/50 hover:bg-[#8B0000]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000]/40",
            !active &&
              !done &&
              "cursor-default border-neutral-200 bg-white text-neutral-600"
          )

          return (
            <li key={item.id}>
              {clickable ? (
                <button
                  type="button"
                  className={className}
                  onClick={() => onStepSelect(index as WizardStepIndex)}
                  aria-label={`Go to ${item.label}`}
                >
                  <StepMarker index={index} active={active} done={done} />
                  <span className="text-xs font-semibold leading-tight">
                    {item.label}
                  </span>
                </button>
              ) : (
                <div
                  className={className}
                  aria-current={active ? "step" : undefined}
                >
                  <StepMarker index={index} active={active} done={done} />
                  <span className="text-xs font-semibold leading-tight">
                    {item.label}
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className={layout.pageSubtitle}>
        Step {activeStep + 1} of {steps.length} · {steps[activeStep].label}
      </p>
    </div>
  )
}

function StepMarker({
  index,
  active,
  done,
}: {
  index: number
  active: boolean
  done: boolean
}) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        active && "bg-white text-[#8B0000]",
        done && "bg-[#8B0000] text-white",
        !active && !done && "bg-neutral-100 text-neutral-600"
      )}
    >
      {index + 1}
    </span>
  )
}

/**
 * Mobile step marker: a numbered ball on the progress rail. Completed steps
 * stay clickable (mirroring the desktop cards), the active step is solid, and
 * steps not yet reached are muted.
 */
function StepBall({
  index,
  active,
  done,
  clickable,
  label,
  onSelect,
}: {
  index: number
  active: boolean
  done: boolean
  clickable: boolean
  label: string
  onSelect: (step: WizardStepIndex) => void
}) {
  const className = cn(
    "flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000]/40",
    active && "border-[#8B0000] bg-[#8B0000] text-white",
    done &&
      "cursor-pointer border-[#8B0000] bg-white text-[#8B0000] hover:bg-[#8B0000] hover:text-white",
    !active && !done && "border-neutral-200 bg-white text-neutral-400"
  )

  return clickable ? (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(index as WizardStepIndex)}
      aria-label={`Go to ${label}`}
    >
      {index + 1}
    </button>
  ) : (
    <div className={className} aria-current={active ? "step" : undefined}>
      {index + 1}
    </div>
  )
}
