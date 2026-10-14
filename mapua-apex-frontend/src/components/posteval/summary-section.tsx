import {
  POST_EVAL_SUMMARY_MAX,
  POST_EVAL_SUMMARY_MIN,
} from "@/components/posteval/constants"
import { Textarea } from "@/components/ui/textarea"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

/**
 * Section 1 — a single free-text summary of how the event went. The backend
 * counts trimmed characters (100–500), so the live counter reflects the same
 * bounds and the field is flagged only once a rejected Continue reveals errors.
 */
export function SummarySection({
  value,
  onChange,
  showError,
}: {
  value: string
  onChange: (value: string) => void
  showError: boolean
}) {
  const trimmedLength = value.trim().length
  const tooShort = trimmedLength < POST_EVAL_SUMMARY_MIN
  const invalid = showError && tooShort

  return (
    <div className={layout.section}>
      <h2 className="text-lg font-bold text-neutral-900">Event Summary</h2>
      <p className="mt-0.5 text-sm font-medium text-neutral-600">
        Describe how the event went — what was accomplished, any issues or
        challenges encountered, notable outcomes, and lessons learned.
      </p>

      <div className="mt-4">
        <Textarea
          name="section_summary"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={7}
          minLength={POST_EVAL_SUMMARY_MIN}
          maxLength={POST_EVAL_SUMMARY_MAX}
          aria-invalid={invalid || undefined}
          placeholder="Write your post-evaluation summary here…"
          className={cn(
            "resize-y text-sm leading-relaxed",
            invalid && "border-red-400 focus-visible:border-red-500"
          )}
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <p
            className={cn(
              "text-xs font-medium",
              invalid ? "text-red-600" : "text-neutral-500"
            )}
          >
            {invalid
              ? `Please write at least ${POST_EVAL_SUMMARY_MIN} characters.`
              : `Minimum ${POST_EVAL_SUMMARY_MIN} characters.`}
          </p>
          <p
            className={cn(
              "shrink-0 text-xs font-semibold tabular-nums",
              tooShort ? "text-neutral-500" : "text-emerald-600"
            )}
          >
            {trimmedLength} / {POST_EVAL_SUMMARY_MAX}
          </p>
        </div>
      </div>
    </div>
  )
}
