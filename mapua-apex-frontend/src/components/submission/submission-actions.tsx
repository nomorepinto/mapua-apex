import { DownloadIcon, RotateCcw } from "lucide-react"
import type { MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SubmissionActions({
  isSubmitting,
  inactive = false,
  onSavePdf,
  onSubmit,
  onClear,
  canClear = true,
}: {
  isSubmitting: boolean
  /**
   * Visual cue that the form still has open items. The button stays clickable:
   * the click is what runs the validation and reveals which fields are missing.
   */
  inactive?: boolean
  onSavePdf: () => void
  onSubmit: (e: MouseEvent) => void
  onClear?: () => void
  canClear?: boolean
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center">
      {/* Left Action: Clear */}
      <div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={!canClear}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-300/80 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:border-red-400 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Right Actions: PDF & Submit */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onSavePdf}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50 sm:h-10 sm:w-auto"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Save as PDF
        </button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className={cn(
            "h-11 w-full min-w-36 rounded-lg bg-[#8B0000] px-10 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#6B0000] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto",
            inactive && "opacity-70"
          )}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  )
}
