import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function LoadingBlock({
  label,
  rows = 3,
  rowClassName = "h-9 w-full",
  className,
}: {
  label: string
  rows?: number
  rowClassName?: string
  className?: string
}) {
  return (
    <div
      aria-label={label}
      className={cn("space-y-2", className)}
      role="status"
    >
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={rowClassName} />
      ))}
    </div>
  )
}
