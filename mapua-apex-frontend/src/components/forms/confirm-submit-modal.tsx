import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

export function ConfirmSubmitModal({
  open,
  title = "Are you sure you want to submit?",
  description,
  isSubmitting = false,
  consent,
  onClose,
  onConfirm,
}: {
  open: boolean
  title?: string
  description: string
  isSubmitting?: boolean
  /**
   * Optional consent gate. When supplied, the disclosure `content` and a single
   * checkbox `label` render in the panel and the Proceed button stays disabled
   * until `checked`. Callers that omit it (post-eval dialogs, reviewer endorse)
   * behave exactly as before.
   */
  consent?: {
    label: string
    content: ReactNode
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
  }
  onClose: () => void
  onConfirm: () => void
}) {
  const blockedByConsent = consent !== undefined && !consent.checked
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) onClose()
      }}
    >
      <DialogPopup className={modal.dialogMd} nested showCloseButton={!isSubmitting}>
        <DialogHeader className="rounded-t-2xl bg-[#8B0000] px-6 py-4 text-center">
          <DialogTitle className="text-base font-bold tracking-normal text-white sm:text-lg">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>

        <DialogPanel className="flex flex-1 flex-col justify-center space-y-5 px-5 py-5 text-center sm:px-8">
          <p className="text-sm leading-relaxed font-normal text-neutral-700">
            {description}{" "}
            <strong className="font-bold text-neutral-900">
              This action cannot be undone.
            </strong>
          </p>
          {consent ? (
            <div className="space-y-3 text-left">
              {consent.content}
              <label className="flex items-start gap-2 text-sm leading-snug text-neutral-700">
                <Checkbox
                  className="mt-0.5"
                  checked={consent.checked}
                  disabled={consent.disabled}
                  onCheckedChange={(checked) => consent.onChange(Boolean(checked))}
                />
                <span>{consent.label}</span>
              </label>
            </div>
          ) : null}
        </DialogPanel>

        <DialogFooter className={cn(layout.actions, "justify-center border-t border-neutral-100 p-4 sm:p-6")}>
          <DialogClose
            disabled={isSubmitting}
            render={<Button variant="outline" type="button" disabled={isSubmitting} />}
          >
            Cancel
          </DialogClose>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || blockedByConsent}
            className="min-h-11 rounded-xl bg-[#8B0000] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0000] sm:w-40"
          >
            {isSubmitting ? "Submitting..." : "Proceed"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
