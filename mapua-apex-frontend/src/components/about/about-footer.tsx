import { GraduationCapIcon, SparklesIcon } from "lucide-react"

export function AboutFooter() {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-neutral-600">
      <SparklesIcon className="h-3.5 w-3.5" />
      <p className="text-[11px] font-semibold tracking-wide">
        Crafted with passion at Mapúa University
      </p>
      <GraduationCapIcon className="h-3.5 w-3.5" />
    </div>
  )
}
