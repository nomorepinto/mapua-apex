import { BookOpen, Sparkles } from "lucide-react"

import { useSubmissionsStart } from "@/components/students/submissions/submissions-start-context"
import { HowItWorks } from "@/components/submission/how-it-works"
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

export function SubmissionGuideButton() {
  const { actions } = useSubmissionsStart()

  return (
    <div className="flex flex-col items-center justify-center gap-2 pt-1 text-center">
      <Button
        type="button"
        variant="outline"
        onClick={() => actions.setGuideOpen(true)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-xs transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <BookOpen className="h-4 w-4 text-[#FBC02D]" />
        Guide
      </Button>
      <p className="text-xs text-neutral-600">
        Need help? Learn how to submit an event activity application
      </p>
    </div>
  )
}

export function SubmissionGuideDialog() {
  const { state, actions } = useSubmissionsStart()

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
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8B0000]/20 bg-[#8B0000]/10 px-2.5 py-0.5 text-xs font-semibold text-[#8B0000] dark:border-[#8B0000]/40 dark:bg-[#8B0000]/30 dark:text-[#FBC02D]">
                <Sparkles className="h-3.5 w-3.5 text-[#FBC02D]" />
                Submission Guide
              </span>
            </div>
            <DialogTitle className="text-xl font-extrabold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
              How to submit an event activity application?
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
              A seamless 3-step workflow to prepare and submit your event
              proposal for official Mapúa approval.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogPanel className="flex-1 overflow-y-auto bg-neutral-50/50 px-4 py-6 sm:px-8">
          <HowItWorks hideHeader className="py-2" />
        </DialogPanel>

        <DialogFooter className="shrink-0 flex-row items-center justify-between border-t border-neutral-200/80 bg-white px-4 py-3.5 sm:px-6">
          <p className="hidden text-xs text-neutral-400 sm:block dark:text-neutral-500">
            Follow these 3 steps to successfully submit your activity proposal
          </p>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
