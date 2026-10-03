import { CheckIcon } from "lucide-react"

import { modal } from "@/config"
import { cn } from "@/lib/utils"

export function SuccessModal({
  open,
  title,
  actionLabel,
  onAction,
}: {
  open: boolean
  title: string
  actionLabel: string
  onAction: () => void
}) {
  if (!open) return null

  return (
    <div
      onClick={onAction}
      className={modal.overlayCenter}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(modal.shell, modal.sm, "min-h-[190px] justify-between rounded-2xl")}
      >
        <div className="flex items-center justify-center bg-[#333333] py-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#52A41C] shadow-md">
            <CheckIcon className="h-8 w-8 stroke-[3.5] text-white" />
          </div>
        </div>

        <div className="space-y-3 px-6 py-4 text-center">
          <h3 className="text-base font-bold text-neutral-900">{title}</h3>
          <button
            type="button"
            onClick={onAction}
            className="min-h-11 w-full cursor-pointer rounded-xl bg-neutral-900 py-2 text-xs font-semibold text-white transition-all hover:bg-black"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
