import { GraduationCapIcon, SparklesIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function AboutFooter({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-4 text-neutral-600", className)}>
      <SparklesIcon className="h-3.5 w-3.5" />
      <p className="text-[11px] font-semibold tracking-wide">
        Crafted with passion at Mapúa University
      </p>
      <GraduationCapIcon className="h-3.5 w-3.5" />
    </div>
  )
}
