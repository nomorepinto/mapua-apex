import type { LucideIcon } from "lucide-react"

import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
  type SegmentedControlSize,
} from "@/lib/segmented-control"
import { cn } from "@/lib/utils"

export interface SegmentedItem<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/**
 * coss segmented control built from the shared `lib/segmented-control` variants
 * so it matches the app's tabs/toggle styling exactly. Two interaction models:
 *  - `tablist`: switches panels (aria-selected) — the Add/View/Reserve switcher.
 *  - `group`: mutually-exclusive toggle (aria-pressed) — Room/Equipment type.
 */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  size = "default",
  mode = "group",
  ariaLabel,
  className,
}: {
  items: SegmentedItem<T>[]
  value: T
  onChange: (value: T) => void
  size?: SegmentedControlSize
  mode?: "tablist" | "group"
  ariaLabel: string
  className?: string
}) {
  const isTab = mode === "tablist"

  return (
    <div
      aria-label={ariaLabel}
      className={cn(segmentedControlRootClassName, className)}
      role={isTab ? "tablist" : "group"}
    >
      {items.map((item) => {
        const active = item.value === value
        const Icon = item.icon
        return (
          <button
            aria-selected={isTab ? active : undefined}
            aria-pressed={isTab ? undefined : active}
            className={cn(
              segmentedControlItemVariants({ size, state: "pressed" }),
              "focus-visible:outline-ring"
            )}
            data-pressed={active || undefined}
            key={item.value}
            onClick={() => onChange(item.value)}
            role={isTab ? "tab" : undefined}
            type="button"
          >
            {Icon ? <Icon aria-hidden="true" /> : null}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
