import { Bug, Mail } from "lucide-react"

import { AboutFooter } from "@/components/about/about-footer"

export function LandingFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-neutral-900 py-16 text-neutral-300 border-t-[8px] border-t-[#8B0000]">
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop"
          alt="Student Event Planning"
          className="h-full w-full object-cover object-center"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          {/* Support Info */}
          <div className="flex flex-col space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <Bug className="h-5 w-5 text-[#FBC02D]" />
              <h3 className="text-xl font-bold text-white">Support & Bug Reports</h3>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-neutral-400">
              Experiencing technical issues, found a bug, or have a feature request? Our development team is here to help keep APEX running smoothly.
            </p>
            <div className="flex flex-col space-y-3 text-sm pt-2 items-center md:items-start">
              <a
                href="mailto:mapuaapex@gmail.com"
                className="flex items-center gap-2 text-white hover:text-[#FBC02D] transition-colors"
              >
                <Mail className="h-4 w-4 text-[#FBC02D]" />
                <span>mapuaapex@gmail.com</span>
              </a>
              <a
                href="mailto:awsstudentbuildergrouparcus@gmail.com"
                className="flex items-center gap-2 text-white hover:text-[#FBC02D] transition-colors"
              >
                <Mail className="h-4 w-4 text-[#FBC02D]" />
                <span>awsstudentbuildergrouparcus@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Quote */}
          <div className="flex flex-col items-center md:items-end space-y-4">
            <div className="rounded-xl bg-black/40 px-6 py-1 backdrop-blur-sm border border-neutral-800">
              <AboutFooter className="text-neutral-300 py-3" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
