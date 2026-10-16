import { LogIn } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function LandingHeader({ onSignIn }: { onSignIn: () => void }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="https://www.mapua.edu.ph/"
            target="_blank"
            rel="noopener noreferrer"
            title="Mapúa University"
            className="flex items-center transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B0000] rounded-sm"
          >
            <img
              src="/mapua_logo.svg"
              alt="Mapúa University"
              className="h-11 sm:h-12 w-auto object-contain shrink-0 transition-transform duration-200 hover:scale-105"
            />
          </a>
          <div className="h-7 w-[1px] bg-neutral-200/80" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto text-[#8B0000] shrink-0" />
            <span className="font-audiowide text-xl tracking-[0.3em] text-[#8B0000] uppercase pt-1">
              APEX
            </span>
          </div>
        </div>
        <div>
          <Button
            onClick={onSignIn}
            size="lg"
            className="bg-[#8B0000] hover:bg-[#6b0000] text-white rounded-xl shadow-md font-semibold text-base px-6 hover:scale-105 hover:-translate-y-0.5 transition-all duration-300"
          >
            Sign In <LogIn className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
