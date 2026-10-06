import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"

export interface ActivityTableSearchProps {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
}

/**
 * Generic all-columns search box for a signatory dashboard table. Prop-driven so
 * both the "For Review" queue and the submission history table can reuse it with
 * their own independent query state.
 */
export function ActivityTableSearch({
  value,
  onChange,
  ariaLabel,
  placeholder = "Search all columns",
}: ActivityTableSearchProps) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
      <Input
        aria-label={ariaLabel}
        className="pl-9"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </div>
  )
}
