import { useState } from "react"
import { useAuth } from "react-oidc-context"
import { ChevronUpIcon, ChevronDownIcon, ShieldIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Every page-group root an admin can hop between. */
const PAGE_GROUP_ROUTES = [
  { label: "Admin", path: "/admin" },
  { label: "OSAAR", path: "/osaar" },
  { label: "CDM Reviewer", path: "/cdm" },
  { label: "Dean", path: "/dean" },
  { label: "Org Adviser", path: "/adviser" },
  { label: "Students", path: "/students" },
  { label: "Landing", path: "/" },
] as const

function isActiveRoute(path: string, pathname: string) {
  if (path === "/") return pathname === "/"
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Floating collapsible navigator for `admin` Cognito group members.
 * Sits at the bottom-right of every page above all other surfaces so
 * admins can switch page groups without editing the URL.
 */
export function AdminPageNavigator() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)

  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const isAdmin = userGroups.some((g) => g.toLowerCase() === "admin")

  if (!auth.isAuthenticated || !isAdmin) return null

  const pathname = window.location.pathname

  return (
    <div className="fixed right-4 bottom-4 z-[9999] flex flex-col items-end gap-2">
      {open && (
        <div className="w-60 rounded-2xl border border-neutral-300 bg-white p-3 shadow-2xl">
          <p className="px-1 pb-2 text-[11px] font-bold tracking-wider text-neutral-500 uppercase">
            Admin Navigation
          </p>
          <div className="flex flex-col gap-1.5">
            {PAGE_GROUP_ROUTES.map((route) => {
              const active = isActiveRoute(route.path, pathname)
              return (
                <button
                  key={route.path}
                  type="button"
                  onClick={() => window.location.assign(route.path)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-[#8B0000] bg-[#8B0000] text-white hover:bg-[#6b0000]"
                      : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                  )}
                >
                  {route.label}
                  <span className={cn("text-xs", active ? "text-white/70" : "text-neutral-400")}>
                    {route.path}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#8B0000] px-4 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#6b0000]"
      >
        <ShieldIcon className="size-4" />
        Admin
        {open ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronUpIcon className="size-4" />
        )}
      </button>
    </div>
  )
}
