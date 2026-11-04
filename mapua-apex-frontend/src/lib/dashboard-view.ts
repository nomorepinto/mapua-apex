import { useCallback } from "react"
import { CalendarIcon, Table2Icon } from "lucide-react"
import { useSearchParams } from "react-router"

/**
 * The two shapes every review-style desk can render: the submissions tables, or
 * the same records plotted on a calendar.
 */
export type SubmissionView = "table" | "calendar"

/**
 * Single definition of the view switch items, so the OSAAR dashboard tab bar and
 * every signatory desk show the same labels, icons and order. Structurally
 * compatible with `SegmentedItem<SubmissionView>` without importing a component.
 */
export const SUBMISSION_VIEW_ITEMS: {
  value: SubmissionView
  label: string
  icon: typeof Table2Icon
}[] = [
  { value: "table", label: "Table", icon: Table2Icon },
  { value: "calendar", label: "Calendar", icon: CalendarIcon },
]

const VIEW_PARAM = "view"

/**
 * Read/write the active desk view from the URL (`?view=calendar`; no param means
 * the table view). Living in the query string keeps the choice across reloads,
 * makes each view deep-linkable, and lets the browser Back button unwind it —
 * which is why the write is not a `replace`.
 */
export function useSubmissionView(): [
  SubmissionView,
  (next: SubmissionView) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(VIEW_PARAM)
  const view: SubmissionView = raw === "calendar" ? "calendar" : "table"

  const setView = useCallback(
    (next: SubmissionView) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === "table") params.delete(VIEW_PARAM)
          else params.set(VIEW_PARAM, next)
          return params
        },
        { preventScrollReset: true }
      )
    },
    [setSearchParams]
  )

  return [view, setView]
}

/**
 * The `?view=` search string for a given view, so a tab bar can preserve the
 * desk's current view while navigating between sections.
 */
export function submissionViewSearch(view: SubmissionView): string {
  return view === "calendar" ? `?${VIEW_PARAM}=calendar` : ""
}
