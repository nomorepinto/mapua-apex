import { LogIn } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export function LandingHeader({ onSignIn }: { onSignIn: () => void }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-auto text-[#8B0000]" />
          <span className="font-audiowide text-xl tracking-[0.3em] text-[#8B0000] uppercase pt-1">
            APEX
          </span>
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
