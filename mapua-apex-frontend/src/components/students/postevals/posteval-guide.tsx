import { BookOpen, ClipboardListIcon } from "lucide-react"

import { usePostEvalsStart } from "@/components/students/postevals/postevals-start-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { modal } from "@/config"
import { cn } from "@/lib/utils"

const GUIDE_STEPS = [
  {
    title: "Event summary",
    body: "Describe how the event went — highlights, challenges, and outcomes (100–500 characters).",
  },
  {
    title: "Financial report",
    body: "Compare your approved budget against what you actually spent, and add any extra expenses.",
  },
  {
    title: "Attendance & evaluation",
    body: "Review the attendance and participant evaluations captured by the companion apps on the event day.",
  },
]

export function PostEvalGuideButton() {
  const { actions } = usePostEvalsStart()

  return (
    <div className="flex flex-col items-center justify-center gap-2 pt-1 text-center">
      <Button
        type="button"
        variant="outline"
        onClick={() => actions.setGuideOpen(true)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-xs transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
      >
        <BookOpen className="h-4 w-4 text-[#FBC02D]" />
        Guide
      </Button>
      <p className="text-xs text-neutral-600">
        Need help? Learn what a post-evaluation covers
      </p>
    </div>
  )
}

export function PostEvalGuideDialog() {
  const { state, actions } = usePostEvalsStart()

  return (
    <Dialog open={state.guideOpen} onOpenChange={actions.setGuideOpen}>
      <DialogPopup
        className={cn(
          modal.dialogLg,
          "overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-2xl"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200/80 bg-white px-4 py-5 sm:px-6">
          <div className="pr-8">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8B0000]/20 bg-[#8B0000]/10 px-2.5 py-0.5 text-xs font-semibold text-[#8B0000]">
                <ClipboardListIcon className="h-3.5 w-3.5" />
                Post-Evaluation Guide
              </span>
            </div>
            <DialogTitle className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
              What is a post-evaluation?
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-neutral-500 sm:text-sm">
              A short report filed after your event, within 3 days. OSAAR reviews
              it — approving it marks your activity as finished.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 overflow-y-auto bg-neutral-50/50 px-4 py-6 sm:px-8">
          <ol className="space-y-4">
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#8B0000] text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-600">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </DialogPanel>

        <DialogFooter className="shrink-0 flex-row items-center justify-between border-t border-neutral-200/80 bg-white px-4 py-3.5 sm:px-6">
          <p className="hidden text-xs text-neutral-400 sm:block">
            File within 3 days of your event to keep it eligible
          </p>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
