import { DownloadIcon, RotateCcw } from "lucide-react"
import type { MouseEvent } from "react"

import { Button } from "@/components/ui/button"

export function SubmissionActions({
  isSubmitting,
  inactive = false,
  showNextPage,
  onNextPage,
  onSavePdf,
  onSubmit,
  onClear,
}: {
  isSubmitting: boolean
  inactive?: boolean
  showNextPage: boolean
  onNextPage: () => void
  onSavePdf: () => void
  onSubmit: (e: MouseEvent) => void
  onClear?: () => void
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center">
      {/* Left Action: Clear */}
      <div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-300/80 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:border-red-400 hover:bg-red-50 dark:border-red-900/60 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/30 sm:h-10 sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Right Actions: PDF & Submit / Next Page */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onSavePdf}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50 sm:h-10 sm:w-auto"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Save as PDF
        </button>
        {showNextPage ? (
          <Button
            type="button"
            onClick={onNextPage}
            disabled={isSubmitting}
            aria-disabled={inactive || isSubmitting}
            className={`h-11 w-full min-w-36 cursor-pointer rounded-lg bg-[#8B0000] px-10 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#6B0000] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto ${inactive ? "cursor-not-allowed opacity-40" : ""}`}
          >
            Next page
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            aria-disabled={inactive || isSubmitting}
            className={`h-11 w-full min-w-36 cursor-pointer rounded-lg bg-[#8B0000] px-10 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#6B0000] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto ${inactive ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        )}
      </div>
    </div>
  )
}
