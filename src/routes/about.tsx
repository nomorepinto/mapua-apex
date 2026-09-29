import { AboutFooter } from "@/components/about/about-footer"
import { AboutHeader } from "@/components/about/about-header"
import { AboutOverview } from "@/components/about/about-overview"
import { DevelopmentTeam } from "@/components/about/development-team"
import { TechStack } from "@/components/about/tech-stack"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function About() {
  return (
    <div className={layout.page}>
      <div className={cn(layout.container, layout.stack)}>
        <AboutHeader />
        <AboutOverview />
        <TechStack />
        <DevelopmentTeam />
        <AboutFooter />
      </div>
    </div>
  )
}
