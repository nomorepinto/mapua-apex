import { format } from "date-fns"
import { Megaphone, LogIn, ArrowRight, Bug, Mail } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogTrigger, DialogPopup, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePublicAnnouncementsQuery } from "@/hooks/use-public"
import { DevelopmentTeam } from "@/components/about/development-team"
import { AboutOverview } from "@/components/about/about-overview"
import { TechStack } from "@/components/about/tech-stack"
import { AboutFooter } from "@/components/about/about-footer"
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll"
import { useAuth } from "react-oidc-context"
import { RoleRedirect } from "@/components/auth/RoleRedirect"
import { layout } from "@/config"

export function LandingPage() {
  const { data: announcements, isLoading: isLoadingAnnouncements, isError: isAnnouncementsError } = usePublicAnnouncementsQuery()
  const auth = useAuth()

  // If the user just logged in or is already logged in, hand them off to RoleRedirect
  if (auth.isAuthenticated) {
    return <RoleRedirect />
  }

  // Show a spinner if Cognito is currently processing the login redirect
  if (auth.isLoading || auth.activeNavigator) {
    return (
      <div className={layout.center}>
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
          <p className="text-sm font-medium text-neutral-600">Signing in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto text-[#8B0000]" />
            <span className="font-audiowide text-xl tracking-[0.3em] text-[#8B0000] uppercase pt-1">
              APEX
            </span>
          </div>
          <div>
            <Button onClick={() => auth.signinRedirect()} size="lg" className="bg-[#8B0000] hover:bg-[#6b0000] text-white rounded-xl shadow-md font-semibold text-base px-6 hover:scale-105 hover:-translate-y-0.5 transition-all duration-300">
              Sign In <LogIn className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
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
              Streamlining event proposals, organization management, and student activities seamlessly. 
              Log in to manage your organizations, review applications, and stay updated.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={450}>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button onClick={() => auth.signinRedirect()} size="lg" className="bg-[#FBC02D] text-neutral-900 hover:bg-[#f9a825] rounded-xl font-bold text-lg px-8 py-6 shadow-lg shadow-yellow-900/20 hover:scale-105 hover:-translate-y-1 transition-all duration-300">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          
          {/* Announcements Section */}
          <RevealOnScroll>
            <section className="flex flex-col">
            <div className="mb-6 flex items-center space-x-3 text-[#8B0000]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                <Megaphone className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold text-neutral-900">Announcements</h2>
            </div>
            
            <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
              <ScrollArea className="h-[500px] pr-4">
                {isLoadingAnnouncements ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    ))}
                  </div>
                ) : isAnnouncementsError ? (
                  <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 p-6 text-center">
                    <p className="font-semibold text-red-600">Could not load announcements.</p>
                    <p className="mt-1 text-sm text-red-500">The public API route might not be deployed yet.</p>
                  </div>
                ) : announcements?.length === 0 || !announcements ? (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
                    <p className="text-neutral-500 font-medium">No announcements yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {announcements.map((a) => (
                      <Dialog key={a.sent_at}>
                        <DialogTrigger className="w-full text-left">
                          <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer hover:border-red-200">
                            <p className="mb-2 text-sm font-semibold text-[#8B0000]">
                              {format(new Date(a.sent_at), "MMMM d, yyyy h:mm a")}
                            </p>
                            <p className="whitespace-pre-wrap text-neutral-700 leading-relaxed line-clamp-3">
                              {a.content}
                            </p>
                            <p className="mt-3 text-xs font-medium text-[#8B0000] hover:underline">Read full announcement &rarr;</p>
                          </div>
                        </DialogTrigger>
                        <DialogPopup>
                          <DialogHeader>
                            <DialogTitle className="text-lg font-semibold text-[#8B0000]">
                              {format(new Date(a.sent_at), "MMMM d, yyyy h:mm a")}
                            </DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh] px-6 py-4">
                            <p className="whitespace-pre-wrap text-neutral-800 leading-relaxed text-sm">
                              {a.content}
                            </p>
                          </ScrollArea>
                        </DialogPopup>
                      </Dialog>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </section>
          </RevealOnScroll>

          {/* About Section */}
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
        </div>
      </main>

      {/* Footer Section */}
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
                <a href="mailto:mapuaapex@gmail.com" className="flex items-center gap-2 text-white hover:text-[#FBC02D] transition-colors">
                  <Mail className="h-4 w-4 text-[#FBC02D]" />
                  <span>mapuaapex@gmail.com</span>
                </a>
                <a href="mailto:awsstudentbuildergrouparcus@gmail.com" className="flex items-center gap-2 text-white hover:text-[#FBC02D] transition-colors">
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
    </div>
  )
}
