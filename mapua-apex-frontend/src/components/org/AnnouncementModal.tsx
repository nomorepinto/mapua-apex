import { X, Megaphone, Calendar, AlertCircle, Bookmark } from "lucide-react"
import { useOrgStore, type Announcement } from "@/stores/org-store"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  selectedAnnouncement?: Announcement | null
}

export function AnnouncementModal({ isOpen, onClose, selectedAnnouncement }: AnnouncementModalProps) {
  const { announcements } = useOrgStore()

  if (!isOpen) return null

  // If a specific announcement was selected, put it first in the array
  const displayAnnouncements = selectedAnnouncement
    ? [selectedAnnouncement, ...announcements.filter(a => a.id !== selectedAnnouncement.id)]
    : announcements;

  return (
    <div className={modal.overlay}>
      <div className={cn(modal.shell, modal.xl, modal.tall)}>
        <div className={cn(modal.header, "bg-[#F8FAFC]")}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#D9291C] text-white shadow-xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#1E293B] sm:text-xl">
                  Institutional Bulletin Board
                </h2>
                <span className="rounded-md border border-red-200/60 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[#D9291C] uppercase">
                  Official Memos
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Administrative notices, SAAF policy timelines, and facility maintenance updates
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={cn(modal.close, "self-end sm:self-center")}
            aria-label="Close bulletin board"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={cn(modal.body, layout.stack)}>
          {displayAnnouncements.length === 0 ? (
            <div className={cn(layout.empty, "text-neutral-600")}>
              <Megaphone className="w-8 h-8 text-neutral-300 mb-3" />
              <h3 className="text-sm font-bold text-[#1E293B] mb-1">No announcements at this time</h3>
              <p className="text-xs text-[#64748B]">Official administrative notices and memorandums will appear here.</p>
            </div>
          ) : (
            displayAnnouncements.map((post) => (
              <div
                key={post.id}
                className={cn(layout.sectionFlush, "transition-all hover:shadow-md")}
              >
                {/* Post Header Line */}
                <div className="flex flex-col justify-between gap-2 border-b border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:flex-row sm:items-center sm:px-7 sm:pt-5">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-md ${
                      post.category === 'Policy'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                        : post.category === 'System'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    }`}>
                      {post.category} Notice
                    </span>

                    {post.memoNumber && (
                      <span className="text-xs font-mono text-[#64748B] font-semibold bg-neutral-100 px-2.5 py-0.5 rounded-md">
                        {post.memoNumber}
                      </span>
                    )}

                    {post.isImportant && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> High Priority
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
                    <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Effective: {post.dateRange}</span>
                  </div>
                </div>

                {/* Headline Title */}
                <div className="px-4 pt-5 pb-3 sm:px-7">
                  <h3 className="text-lg sm:text-xl font-bold text-[#1E293B] leading-snug">
                    {post.title}
                  </h3>
                </div>

                {/* Formatted Memo Body Text Container (Internal Scroll for Long Content) */}
                <div className="mx-4 mb-5 max-h-[250px] overflow-y-auto rounded-xl border border-neutral-200/80 bg-[#F8FAFC] p-4 shadow-inner scrollbar-thin sm:mx-7 sm:p-6">
                  <p className="text-xs sm:text-sm text-[#334155] font-sans leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>
                </div>

                {/* Post Footer / Author Sign-off */}
                <div className="flex flex-col gap-2 border-t border-neutral-100 bg-[#F8FAFC] px-4 py-3.5 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[#D9291C]" />
                    <span className="font-semibold text-[#1E293B]">{post.author}</span>
                    <span className="text-neutral-600">• {post.authorRole}</span>
                  </div>
                  <span className="text-[11px] text-neutral-600 font-medium">APEX Institutional Bulletin</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={modal.footer}>
          <span className="text-xs text-neutral-600">
            Showing {displayAnnouncements.length} official memorandum posts
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full cursor-pointer rounded-xl bg-[#1E293B] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 sm:w-auto"
          >
            Close Bulletin Board
          </button>
        </div>

      </div>
    </div>
  )
}
