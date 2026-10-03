import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

export function ConfirmClearModal({
  open,
  title = "Are you sure you want to clear?",
  description = "This action will clear your student activity form with the data you have inputted.",
  onClose,
  onConfirm,
}: {
  open: boolean
  title?: string
  description?: string
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div
      onClick={onClose}
      className={modal.overlayCenter}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(modal.shell, modal.md, "min-h-[200px] justify-between rounded-2xl")}
      >
        <div className="bg-[#333333] px-6 py-4 text-center">
          <h3 className="text-base font-bold tracking-normal text-white sm:text-lg">
            {title}
          </h3>
        </div>

        <div className="flex flex-1 flex-col justify-center space-y-5 px-5 py-5 text-center sm:px-8">
          <p className="text-sm leading-relaxed font-normal text-neutral-700">
            {description}{" "}
            <strong className="font-bold text-neutral-900">
              This action cannot be undone.
            </strong>
          </p>

          <div className={cn(layout.actionRow, "justify-center pt-1 sm:items-center sm:gap-4")}>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 w-full cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition-all hover:bg-neutral-50 sm:w-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="min-h-11 w-full cursor-pointer rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#B91C1C] sm:w-40"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
