import { Sparkles, ClipboardList, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"

export interface HowItWorksProps {
  className?: string
  hideHeader?: boolean
}

interface StepItem {
  id: string
  number: string
  title: string
  description: string
  icon: typeof Sparkles
  actionLabel?: string
}

const STEPS: StepItem[] = [
  {
    id: "step-1",
    number: "01",
    title: "Event Setup",
    description:
      "Start by answering the event setup section. Provide your official event title and specify whether your student organization will reserve Mapúa school facilities and campus venues.",
    icon: Sparkles,
    actionLabel: "Complete the quick setup",
  },
  {
    id: "step-2",
    number: "02",
    title: "Activity Proposal & Details",
    description:
      "Proceed to the Student Activity Application Form (SAAF) to input comprehensive event details, objectives, budget proposals, and student proponents. If you agreed to reserve facilities, you will also complete the venue reservation and/or equipment requests form alongside it.",
    icon: ClipboardList,
    actionLabel: "Comprehensive SAAF",
  },
  {
    id: "step-3",
    number: "03",
    title: "Submit & Await Approval",
    description:
      "Submit your finalized proposal for multi-tiered review and wait for approval. Track real-time progress and endorsements from your organization advisers, department heads, and OSA officers.",
    icon: Rocket,
    actionLabel: "Endorsement Tracking",
  },
]

export function HowItWorks({ className, hideHeader = false }: HowItWorksProps) {
  return (
    <section
      aria-label="How it works"
      className={cn("w-full select-none", className)}
    >
      {/* Section Header */}
      {!hideHeader && (
        <div className="text-center mb-8 space-y-2.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            How to submit an event activity application?
          </h2>
          <p className="max-w-xl mx-auto text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-normal leading-relaxed">
            A seamless 3-step workflow to prepare and submit your event proposal for
            official Mapúa approval.
          </p>
        </div>
      )}

      {/* Step Section Boxes */}
      <div className="space-y-4">
        {STEPS.map((step) => {
          const Icon = step.icon

          return (
            <div
              key={step.id}
              className="relative rounded-2xl sm:rounded-3xl border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                {/* Glossy Icon + Step Badge */}
                <div className="flex items-center sm:flex-col gap-3 shrink-0">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#8B0000] via-[#7a0000] to-[#5e0000] text-white shadow-md shadow-[#8B0000]/25 ring-1 ring-[#8B0000]/30">
                    <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-[#FBC02D]" />
                  </div>
                  <span className="rounded-full border border-red-200/80 bg-red-50/80 px-3 py-0.5 text-xs font-bold text-[#8B0000] dark:border-red-900/60 dark:bg-[#6b0000]/40 dark:text-[#FBC02D]">
                    Step {step.number}
                  </span>
                </div>

                {/* Step Details */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                      {step.title}
                    </h3>
                    {step.actionLabel && (
                      <span className="rounded-md border border-[#FBC02D]/40 bg-[#FBC02D]/15 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-amber-900 dark:text-[#FBC02D]">
                        {step.actionLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
