import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Announcement } from "@/lib/types"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

export function AnnouncementsTable({
  announcements,
  onCreate,
  onEdit,
  onDelete,
}: {
  announcements: Announcement[]
  onCreate: () => void
  onEdit: (announcement: Announcement) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={layout.sectionFlush}>
      <div className="border-b border-neutral-200 p-6">
        <h2 className="text-lg font-bold text-neutral-900">
          Current Announcements
        </h2>
      </div>

      {announcements.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-neutral-400">
          No announcements yet. Create one to notify organizations.
        </p>
      ) : (
        <div className={layout.tableWrap}>
          <table className={cn("border-collapse text-left text-sm", layout.table)}>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs font-semibold tracking-wider text-neutral-600 uppercase">
                <th className="px-6 py-3.5">Title</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Time</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-150">
              {announcements.map((announcement) => (
                <tr
                  key={announcement.id}
                  className="transition-colors hover:bg-neutral-50/70"
                >
                  <td className="px-6 py-4 font-semibold whitespace-normal text-neutral-900">
                    {announcement.title}
                  </td>
                  <td className="px-6 py-4 text-xs whitespace-nowrap text-neutral-700">
                    {announcement.date}
                  </td>
                  <td className="px-6 py-4 text-xs whitespace-nowrap text-neutral-700">
                    {announcement.time}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(announcement)}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <PencilIcon className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(announcement.id)}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                      >
                        <Trash2Icon className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-neutral-200 p-6">
        <Button
          onClick={onCreate}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#800000] px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-[#660000] sm:h-10 sm:w-auto"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Create Announcement</span>
        </Button>
      </div>
    </div>
  )
}
