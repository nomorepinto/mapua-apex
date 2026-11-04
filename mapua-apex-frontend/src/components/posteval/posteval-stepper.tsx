import { POST_EVAL_STEPS, type PostEvalStepIndex } from "@/components/posteval/constants"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

/**
 * Step rail for the post-eval wizard. The financial page is dropped for a
 * no-budget submission, collapsing the rail to two steps; the remaining steps
 * keep their wizard indices so navigation is unchanged. Completed steps stay
 * clickable so the submitter can jump back to fix an earlier section.
 */
export function PostEvalStepper({
  step,
  farthestStep,
  eventTitle,
  includeFinancial = true,
  onStepSelect,
}: {
  step: PostEvalStepIndex
  farthestStep: PostEvalStepIndex
  eventTitle?: string
  includeFinancial?: boolean
  onStepSelect: (step: PostEvalStepIndex) => void
}) {
  const steps = POST_EVAL_STEPS.map((item, index) => ({
    item,
    index: index as PostEvalStepIndex,
  })).filter(({ index }) => includeFinancial || index !== 1)

  // `index` is the wizard step the panels key off; `position` is the 1-based
  // number shown on the rail, which shifts when the financial page is dropped.
  const stepStates = steps.map(({ item, index }, position) => {
    const active = index === step
    const done = index <= farthestStep && !active
    return { item, index, position, active, done, clickable: done }
  })
  const activeState =
    stepStates.find(({ index }) => index === step) ?? stepStates[0]

  return (
    <div className="space-y-3">
      {eventTitle ? (
        <p className="text-sm font-semibold text-neutral-800">{eventTitle}</p>
      ) : null}

      {/* Mobile progress rail */}
      <ol className="flex items-center sm:hidden">
        {stepStates.map(({ item, index, position, active, done, clickable }) => (
          <li
            key={item.id}
            className={cn("flex items-center", position > 0 && "flex-1")}
          >
            {position > 0 && (
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
              number={position + 1}
              active={active}
              done={done}
              clickable={clickable}
              label={item.label}
              onSelect={onStepSelect}
            />
          </li>
        ))}
      </ol>

      {/* Desktop cards */}
      <ol
        className={cn(
          "hidden gap-2 sm:grid",
          includeFinancial ? "sm:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {stepStates.map(({ item, index, position, active, done, clickable }) => {
          const className = cn(
            "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left",
            active && "border-[#8B0000] bg-[#8B0000] text-white",
            done &&
              "cursor-pointer border-[#8B0000]/30 bg-[#8B0000]/5 text-[#8B0000] transition-colors hover:border-[#8B0000]/50 hover:bg-[#8B0000]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000]/40",
            !active && !done && "cursor-default border-neutral-200 bg-white text-neutral-600"
          )

          return (
            <li key={item.id}>
              {clickable ? (
                <button
                  type="button"
                  className={className}
                  onClick={() => onStepSelect(index as PostEvalStepIndex)}
                  aria-label={`Go to ${item.label}`}
                >
                  <StepMarker number={position + 1} active={active} done={done} />
                  <span className="text-xs font-semibold leading-tight">
                    {item.label}
                  </span>
                </button>
              ) : (
                <div className={className} aria-current={active ? "step" : undefined}>
                  <StepMarker number={position + 1} active={active} done={done} />
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
        Step {activeState.position + 1} of {stepStates.length} ·{" "}
        {activeState.item.label}
      </p>
    </div>
  )
}

function StepMarker({
  number,
  active,
  done,
}: {
  number: number
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
      {number}
    </span>
  )
}

function StepBall({
  index,
  number,
  active,
  done,
  clickable,
  label,
  onSelect,
}: {
  index: PostEvalStepIndex
  number: number
  active: boolean
  done: boolean
  clickable: boolean
  label: string
  onSelect: (step: PostEvalStepIndex) => void
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
      onClick={() => onSelect(index)}
      aria-label={`Go to ${label}`}
    >
      {number}
    </button>
  ) : (
    <div className={className} aria-current={active ? "step" : undefined}>
      {number}
    </div>
  )
}
