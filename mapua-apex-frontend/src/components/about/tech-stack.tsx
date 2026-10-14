import { Code2Icon } from "lucide-react"

import { TECH_STACK } from "@/components/about/team"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function TechStack() {
  return (
    <div className={layout.section}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
          <Code2Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1E293B]">Tech Stack</h2>
          <p className="text-xs text-neutral-600">
            Built with modern, production-grade tooling
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TECH_STACK.map((tech) => (
          <a
            key={tech.name}
            href={tech.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 hover:shadow-sm cursor-pointer",
              tech.color
            )}
          >
            {tech.name}
          </a>
        ))}
      </div>
    </div>
  )
}
