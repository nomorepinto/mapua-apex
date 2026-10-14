import { Calendar, FileText, Megaphone } from "lucide-react"

import { cn } from "@/lib/utils"

export function AdminNavigationPanel() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const navItems = [
    {
      id: "applications-calendar-section",
      label: "Applications Calendar",
      icon: Calendar,
      iconClass: "text-[#8B0000] group-hover:text-[#8B0000]",
    },
    {
      id: "submissions-section",
      label: "Submissions Queue",
      icon: FileText,
      iconClass: "text-amber-700 group-hover:text-[#8B0000]",
    },
    {
      id: "announcements-section",
      label: "Announcements",
      icon: Megaphone,
      iconClass: "text-blue-700 group-hover:text-[#8B0000]",
    },
  ]

  return (
    <nav
      aria-label="Dashboard quick navigation"
      className="grid w-full grid-cols-1 gap-3 pt-1 sm:grid-cols-3"
    >
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollTo(item.id)}
            className="group flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 shadow-2xs transition-all hover:border-[#8B0000]/40 hover:bg-neutral-50 hover:text-[#8B0000] hover:shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                item.iconClass
              )}
            />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
