import { format } from "date-fns"
import { Megaphone } from "lucide-react"

import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RevealOnScroll } from "@/components/ui/reveal-on-scroll"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicAnnouncementsQuery } from "@/hooks/use-public"

export function LandingAnnouncements() {
  const {
    data: announcements,
    isLoading,
    isError,
  } = usePublicAnnouncementsQuery()

  return (
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
            {isLoading ? (
              <AnnouncementsSkeleton />
            ) : isError ? (
              <AnnouncementsError />
            ) : !announcements || announcements.length === 0 ? (
              <AnnouncementsEmpty />
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.sent_at}
                    sentAt={announcement.sent_at}
                    content={announcement.content}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </section>
    </RevealOnScroll>
  )
}

function AnnouncementsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  )
}

function AnnouncementsError() {
  return (
    <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 p-6 text-center">
      <p className="font-semibold text-red-600">Could not load announcements.</p>
      <p className="mt-1 text-sm text-red-500">The public API route might not be deployed yet.</p>
    </div>
  )
}

function AnnouncementsEmpty() {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
      <p className="text-neutral-500 font-medium">No announcements yet.</p>
    </div>
  )
}

function AnnouncementCard({ sentAt, content }: { sentAt: string; content: string }) {
  const timestamp = format(new Date(sentAt), "MMMM d, yyyy h:mm a")

  return (
    <Dialog>
      <DialogTrigger className="w-full text-left">
        <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer hover:border-red-200">
          <p className="mb-2 text-sm font-semibold text-[#8B0000]">{timestamp}</p>
          <p className="whitespace-pre-wrap text-neutral-700 leading-relaxed line-clamp-3">
            {content}
          </p>
          <p className="mt-3 text-xs font-medium text-[#8B0000] hover:underline">
            Read full announcement &rarr;
          </p>
        </div>
      </DialogTrigger>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#8B0000]">{timestamp}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] px-6 py-4">
          <p className="whitespace-pre-wrap text-neutral-800 leading-relaxed text-sm">{content}</p>
        </ScrollArea>
      </DialogPopup>
    </Dialog>
  )
}
