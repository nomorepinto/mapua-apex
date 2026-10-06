import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useReviewDashboardContext } from "@/components/signatories/dashboard/review-dashboard-context"

export function ReviewDashboardSearch() {
  const { state, actions } = useReviewDashboardContext()

  return (
    <div className="border-b border-neutral-200 px-6 py-4">
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        <Input
          aria-label="Search review queue"
          className="pl-9"
          onChange={(event) =>
            actions.handleSearchChange(event.currentTarget.value)
          }
          placeholder="Search all columns"
          type="search"
          value={state.search}
        />
      </div>
    </div>
  )
}
