import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll"

export function LandingHero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden bg-neutral-900 px-6 py-24 text-center sm:py-32 lg:px-8">
      {/* Looping Video Background */}
      <div className="absolute inset-0 z-0 bg-neutral-900">
        <div className="absolute inset-0 bg-neutral-900/60 z-10 mix-blend-multiply" />
        <video
          src="/placeholder_vid.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover object-top opacity-70"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl">
        <RevealOnScroll delay={0}>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#FBC02D] sm:text-6xl uppercase">
            Mapúa APEX
          </h1>
        </RevealOnScroll>
        <RevealOnScroll delay={150}>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Administrative Portal For Events Exchange
          </h2>
        </RevealOnScroll>
        <RevealOnScroll delay={300}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
            Streamlining event proposals, organization management, and student
            activities seamlessly. Log in to manage your organizations, review
            applications, and stay updated.
          </p>
        </RevealOnScroll>
        <RevealOnScroll delay={450}>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button
              onClick={onSignIn}
              size="lg"
              className="bg-[#FBC02D] text-neutral-900 hover:bg-[#f9a825] rounded-xl font-bold text-lg px-8 py-6 shadow-lg shadow-yellow-900/20 hover:scale-105 hover:-translate-y-1 transition-all duration-300"
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  )
}
