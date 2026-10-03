import { layout } from "@/config"
import { cn } from "@/lib/utils"

export const SAAF_STEPS = [
  { id: "classification", label: "Classification" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
  { id: "alignment", label: "Alignment & budget" },
] as const

export type SaafStepIndex = 0 | 1 | 2 | 3

export function SaafStepper({
  step,
  farthestStep,
  eventTitle,
  onStepSelect,
}: {
  step: SaafStepIndex
  farthestStep: SaafStepIndex
  eventTitle?: string
  onStepSelect: (step: SaafStepIndex) => void
}) {
  return (
    <div className="space-y-3">
      {eventTitle ? (
        <p className="text-sm font-semibold text-neutral-800">
          {eventTitle}
        </p>
      ) : null}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SAAF_STEPS.map((item, index) => {
          const active = index === step
          const reached = index <= farthestStep
          const done = reached && !active
          const clickable = done
          const className = cn(
            "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left",
            active && "border-[#8B0000] bg-[#8B0000] text-white",
            done &&
              "cursor-pointer border-[#8B0000]/30 bg-[#8B0000]/5 text-[#8B0000] transition-colors hover:border-[#8B0000]/50 hover:bg-[#8B0000]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000]/40",
            !active &&
              !done &&
              "cursor-default border-neutral-200 bg-white text-neutral-600",
          )

          return (
            <li key={item.id}>
              {clickable ? (
                <button
                  type="button"
                  className={className}
                  onClick={() => onStepSelect(index as SaafStepIndex)}
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
        Step {step + 1} of {SAAF_STEPS.length} · {SAAF_STEPS[step].label}
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
        !active && !done && "bg-neutral-100 text-neutral-600",
      )}
    >
      {index + 1}
    </span>
  )
}
