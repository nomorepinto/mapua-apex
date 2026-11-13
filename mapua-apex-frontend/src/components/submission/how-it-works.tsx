import { NotebookPen, Rocket, Sparkles, ClipboardList } from "lucide-react"
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
      "Start by answering the event setup section: your official event title, the campus location (off-campus events cannot reserve school facilities and skip the CDM review desk), whether you will reserve facilities or bring outside equipment, and whether the activity runs on a budget and how it is funded. Finish by opening the Terms and conditions and ticking the agreement — the Continue button stays locked until you accept.",
    icon: Sparkles,
    actionLabel: "Setup + Terms acceptance",
  },
  {
    id: "step-2",
    number: "02",
    title: "Activity Proposal (SAAF)",
    description:
      "Proceed to the Student Activity Application Form (SAAF) and complete it step by step: classify the activity (co- or extra-curricular, plus its nature — selling and fundraising activities carry a booth/concession rental note), list the proponents and collaborating organizations, request rooms, time slots, and equipment (including outside equipment you bring in), then fill the activity details, institutional alignment, and budget proposal. The event date must be at least 10 calendar days ahead; the filing window and standard turnaround time are stated in the Terms & Conditions.",
    icon: ClipboardList,
    actionLabel: "Guided multi-step form",
  },
  {
    id: "step-3",
    number: "03",
    title: "Consent, Submit & Track",
    description:
      "Before submitting, confirm every disclaimer: tick the Data Privacy Act of 2012 (RA 10173) consent and all of the Terms & Conditions acknowledgements — the versions you accept are recorded with your paper. Your proposal then moves through the multi-tiered review chain (organization adviser, department dean, OSA, and the CDM desk for on-campus facilities). Track real-time progress in the Milestone & Progress view, which shows how long each desk takes and the total time to final approval under your document number.",
    icon: Rocket,
    actionLabel: "Endorsement tracking",
  },
  {
    id: "step-4",
    number: "04",
    title: "Post-Evaluation",
    description:
      "After the activity is done, close it out through the Post-Evaluation wizard: pick the approved event, write the activity summary, reconcile the financial report against the approved budget (skipped for no-budget activities), and record attendance before submitting.",
    icon: NotebookPen,
    actionLabel: "Post-event report",
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
            A seamless 4-step workflow to prepare, submit, and close out your
            event proposal for official Mapúa approval.
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
