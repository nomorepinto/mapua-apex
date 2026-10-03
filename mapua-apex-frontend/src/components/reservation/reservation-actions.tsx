import { DownloadIcon, RotateCcw } from "lucide-react"

export function ReservationActions({
  isSubmitting = false,
  inactive = false,
  clearDisabled = false,
  onSavePdf,
  onGoBack,
  onClear,
}: {
  isSubmitting?: boolean
  inactive?: boolean
  clearDisabled?: boolean
  onSavePdf: () => void
  onGoBack: () => void
  onClear?: () => void
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center">
      {/* Right Actions: PDF, Go Back, Clear & Submit */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onSavePdf}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50 sm:h-10 sm:w-auto"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Save as PDF
        </button>
        <button
          type="button"
          onClick={onGoBack}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[#990000] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#7a0000] sm:h-10 sm:w-auto"
        >
          Go Back to Other Page
        </button>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            disabled={clearDisabled}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-300/80 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:border-red-400 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40 dark:border-red-900/60 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/30 sm:h-10 sm:w-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-disabled={inactive || isSubmitting}
          className={`flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[#0B6623] px-8 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#084D1A] disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-auto ${inactive ? "cursor-not-allowed opacity-40" : ""}`}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  )
}
