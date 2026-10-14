import { AboutOverview } from "@/components/about/about-overview"
import { DevelopmentTeam } from "@/components/about/development-team"
import { TechStack } from "@/components/about/tech-stack"
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll"

export function LandingAbout() {
  return (
    <RevealOnScroll delay={150}>
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="mb-4 border-b border-neutral-100 pb-3">
            <h2 className="text-3xl font-bold text-neutral-900">About Mapúa APEX</h2>
          </div>
          <div className="flex flex-col gap-5">
            <AboutOverview />
            <div className="w-full h-px bg-neutral-100" />
            <TechStack />
            <div className="w-full h-px bg-neutral-100" />
            <DevelopmentTeam />
          </div>
        </div>
      </section>
    </RevealOnScroll>
  )
}
