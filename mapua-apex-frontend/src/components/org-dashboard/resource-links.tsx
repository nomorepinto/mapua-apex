import { Cloud, FileText, Folder } from "lucide-react"

import { layout } from "@/config"

const RESOURCES = [
  {
    label: "Official Templates",
    alert: "Official Templates directory coming soon",
    activity: "Opened Official Templates resource link.",
    icon: FileText,
    hoverColor: "group-hover:text-[#3B82F6]",
  },
  {
    label: "Governance and Documentation",
    alert: "Governance and Documentation coming soon",
    activity: "Opened Governance and Documentation resource link.",
    icon: Folder,
    hoverColor: "group-hover:text-[#F59E0B]",
  },
  {
    label: "Shared Drive",
    alert: "Shared Drive coming soon",
    activity: "Opened Shared Drive resource link.",
    icon: Cloud,
    hoverColor: "group-hover:text-[#10B981]",
  },
] as const

export function ResourceLinks({
  onAccess,
}: {
  onAccess: (title: string, description: string) => void
}) {
  return (
    <div className={layout.section}>
      <h2 className="mb-5 text-xl font-bold text-[#1E293B]">
        Resource Quick Links
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {RESOURCES.map((resource) => {
          const Icon = resource.icon
          return (
            <button
              key={resource.label}
              onClick={() => {
                onAccess("Resource accessed", resource.activity)
                alert(resource.alert)
              }}
              className="group flex min-h-11 cursor-pointer items-center gap-3 text-left"
            >
              <Icon
                className={`h-5 w-5 shrink-0 text-neutral-400 transition-colors ${resource.hoverColor}`}
              />
              <span className="text-sm font-semibold text-[#64748B] transition-colors group-hover:text-[#1E293B]">
                {resource.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
