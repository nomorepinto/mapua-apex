import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRightLeftIcon,
  LogOutIcon,
  MenuIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { Link, NavLink } from "react-router"
import { useAuth } from "react-oidc-context"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetPopup, SheetTitle } from "@/components/ui/sheet"
import { modal } from "@/config"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSignOut } from "@/hooks/use-sign-out"
import { cn } from "@/lib/utils"

export type AppSidebarItem = {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export type AppSidebarPanelSwitch = {
  label: string
  to: string
}

function navClassName({ isActive }: { isActive: boolean }) {
  return cn(
    "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
    isActive
      ? "bg-white font-bold text-neutral-900 shadow-md shadow-black/10"
      : "text-white/90 hover:bg-neutral-200/20 hover:text-white",
  )
}

function SidebarBrand({
  homeTo,
  onNavigate,
  compact = false,
}: {
  homeTo: string
  onNavigate?: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <Link
        to={homeTo}
        onClick={onNavigate}
        className="flex min-w-0 items-center gap-2"
        aria-label="Go to dashboard"
      >
        <Logo className="h-8 w-auto shrink-0" />
        <span className="font-audiowide text-sm tracking-[0.35em] ps-[0.35em] uppercase">
          APEX
        </span>
      </Link>
    )
  }

  return (
    <div className="flex flex-col items-center pt-2 pb-2 text-center">
      <div className="relative mb-2.5 flex items-center justify-center">
        <Link
          to={homeTo}
          onClick={onNavigate}
          className="cursor-pointer transition-opacity hover:opacity-85 focus:outline-hidden"
          aria-label="Go to dashboard"
        >
          <Logo className="h-auto w-[min(11.7rem,100%)] max-w-full" />
        </Link>
      </div>

      <h2 className="font-audiowide text-[clamp(1.25rem,5cqi,1.5rem)] leading-none font-normal tracking-[0.6em] ps-[0.6em] text-white uppercase">
        APEX
      </h2>

      <p className="mt-2 max-w-[14rem] px-1 font-sans text-xs leading-snug font-medium tracking-wide text-[#FBC02D] antialiased">
        Administrative Portal For Events Exchange
      </p>
    </div>
  )
}

function SidebarNav({
  items,
  onNavigate,
  onSignOut,
  panelSwitch,
}: {
  items: AppSidebarItem[]
  onNavigate?: () => void
  onSignOut: () => void
  panelSwitch?: AppSidebarPanelSwitch
}) {
  return (
    <nav className="space-y-1.5 pt-2">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={navClassName}
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0",
                  isActive ? "text-red-800" : "text-white/80",
                )}
              />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}

      {panelSwitch ? (
        <Link
          to={panelSwitch.to}
          onClick={onNavigate}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/90 transition-all hover:bg-neutral-200/20 hover:text-white"
        >
          <ArrowRightLeftIcon className="h-4.5 w-4.5 shrink-0 text-white/80" />
          <span>{panelSwitch.label}</span>
        </Link>
      ) : null}

      <button
        type="button"
        onClick={onSignOut}
        className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/90 transition-all hover:bg-neutral-200/20 hover:text-white"
      >
        <LogOutIcon className="h-4.5 w-4.5 text-white/80" />
        <span>Sign Out</span>
      </button>
    </nav>
  )
}

function SidebarUser({
  name,
  displayRole,
  aboutTo,
  onNavigate,
}: {
  name: string
  displayRole: string
  aboutTo: string
  onNavigate?: () => void
}) {
  return (
    <div className="border-t border-red-900/60 pt-4">
      <div className="rounded-xl border border-red-900/50 bg-[#6b0000]/90 p-3.5 shadow-sm">
        <p className="truncate text-sm font-semibold tracking-wide text-white">
          {name}
        </p>
        <p className="mt-0.5 text-xs font-medium break-words text-[#FBC02D]">
          {displayRole}
        </p>
        <Link
          to={aboutTo}
          onClick={onNavigate}
          className="mt-3 flex min-h-11 items-center gap-2 rounded-lg px-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white border-3 border-red-900"
        >
          <UsersIcon className="size-4 shrink-0" />
          About APEX
        </Link>
      </div>
    </div>
  )
}

function SidebarPanel({
  homeTo,
  aboutTo,
  items,
  name,
  displayRole,
  onNavigate,
  onSignOut,
  onClose,
  panelSwitch,
  from = "side",
}: {
  homeTo: string
  aboutTo: string
  items: AppSidebarItem[]
  name: string
  displayRole: string
  onNavigate?: () => void
  onSignOut: () => void
  onClose?: () => void
  panelSwitch?: AppSidebarPanelSwitch
  from?: "side" | "top"
}) {
  const isTop = from === "top"

  return (
    <div
      className={cn(
        "@container flex min-h-0 flex-col overflow-y-auto bg-[#8B0000] text-white select-none",
        isTop
          ? "max-h-[min(90dvh,100%)] px-3 pb-4 pt-[env(safe-area-inset-top)]"
          : "h-full justify-between p-4",
      )}
    >
      <div className={isTop ? "space-y-3" : "space-y-6"}>
        <div
          className={cn(
            "flex gap-2",
            isTop ? "min-h-14 items-center justify-between" : "items-start justify-between",
          )}
        >
          <div className="min-w-0 flex-1">
            <SidebarBrand
              homeTo={homeTo}
              onNavigate={onNavigate}
              compact={isTop}
            />
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white/90 transition-colors hover:bg-white/10",
                !isTop && "mt-1",
              )}
              aria-label="Close navigation"
            >
              <XIcon className="size-5" />
            </button>
          ) : null}
        </div>
        <SidebarNav
          items={items}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          panelSwitch={panelSwitch}
        />
      </div>
      <div className={isTop ? "mt-4" : undefined}>
        <SidebarUser
          name={name}
          displayRole={displayRole}
          aboutTo={aboutTo}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}

export function AppSidebar({
  homeTo,
  items,
  switchPanelTo,
  switchPanelLabel,
}: {
  homeTo: string
  items: AppSidebarItem[]
  switchPanelTo?: string
  switchPanelLabel?: string
}) {
  const auth = useAuth()
  const profile = auth.user?.profile
  const givenFamily = [profile?.given_name, profile?.family_name]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
  const name =
    (typeof profile?.name === "string" && profile.name.trim()) ||
    givenFamily ||
    profile?.email ||
    "Guest"
  const userGroups = (auth.user?.profile["cognito:groups"] as string[]) || []
  const displayRole =
    userGroups.length > 0
      ? userGroups.map((g) => g.replace(/_/g, " ")).join(", ")
      : "No role assigned"

  // OSAAR and admin staff can access both the admin and signatory panels but
  // are unlikely to edit the URL by hand, so surface a one-click switch for them.
  const isPanelSwitcher = userGroups.some((g) => {
    const group = g.toLowerCase()
    return group === "osaar" || group === "admin"
  })
  const panelSwitch =
    isPanelSwitcher && switchPanelTo
      ? { to: switchPanelTo, label: switchPanelLabel ?? "Switch Panel" }
      : undefined

  const handleSignOut = useSignOut()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const isDesktop = useMediaQuery("lg")
  const aboutTo = `${homeTo.replace(/\/dashboard$/, "")}/about`

  useEffect(() => {
    if (isDesktop) setMobileOpen(false)
  }, [isDesktop])

  const requestSignOut = () => {
    setMobileOpen(false)
    setSignOutOpen(true)
  }

  const panelProps = {
    homeTo,
    aboutTo,
    items,
    name,
    displayRole,
    panelSwitch,
    onSignOut: requestSignOut,
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-2 bg-[#8B0000] px-2 pt-[env(safe-area-inset-top)] text-white lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          <MenuIcon className="size-5" />
        </button>
        <Link
          to={homeTo}
          className="flex min-w-0 items-center gap-2"
          aria-label="Go to dashboard"
        >
          <Logo className="h-8 w-auto shrink-0" />
          <span className="font-audiowide text-sm tracking-[0.35em] ps-[0.35em] uppercase">
            APEX
          </span>
        </Link>
      </header>

      <aside className="sticky top-0 z-20 hidden h-dvh w-64 shrink-0 shadow-xl lg:flex lg:flex-col">
        <SidebarPanel {...panelProps} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetPopup
          side="top"
          showCloseButton={false}
          className="max-h-[min(90dvh,100%)] w-full rounded-b-2xl border-0 bg-[#8B0000] p-0 text-white shadow-[0_16px_40px_rgba(0,0,0,0.28)] before:hidden data-ending-style:opacity-100 data-starting-style:opacity-100 data-ending-style:-translate-y-full data-starting-style:-translate-y-full"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div id="mobile-nav" className="min-h-0">
            <SidebarPanel
              {...panelProps}
              from="top"
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </SheetPopup>
      </Sheet>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogPopup className={modal.dialogMd}>
          <DialogHeader>
            <DialogTitle>Sign out of APEX?</DialogTitle>
            <DialogDescription>
              You will need to sign in again to continue reviewing or submitting
              proposals.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="sr-only">Confirms sign out.</DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSignOut}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  )
}
