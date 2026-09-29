import { PlusIcon } from "lucide-react"

import {
  formatAnnouncementPostedAt,
  useAdminDashboard,
} from "@/components/admin/dashboard/admin-dashboard-context"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { layout } from "@/config"

export function AdminAnnouncementsSection() {
  const { state, actions } = useAdminDashboard()

  return (
    <section className={layout.section}>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900">
            Announcements
          </h2>
          <p className="text-xs text-neutral-500">
            Post a notice, or open a row to edit or delete it.
          </p>
        </div>
        <Button onClick={actions.openCreate} type="button">
          <PlusIcon aria-hidden="true" />
          New announcement
        </Button>
      </div>
      <div className={layout.tableWrap}>
        <Table className={layout.table}>
          <TableHeader>
            <TableRow className="border-b border-neutral-200 text-neutral-500">
              <TableHead className="text-xs font-bold uppercase">Posted</TableHead>
              <TableHead className="text-xs font-bold uppercase">Notice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.announcementsLoading ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  Loading announcements…
                </TableCell>
              </TableRow>
            ) : state.announcementsError ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-12 text-center text-sm text-rose-600"
                >
                  Could not load announcements.
                </TableCell>
              </TableRow>
            ) : state.announcements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="py-12 text-center text-sm text-neutral-400"
                >
                  No announcements have been posted.
                </TableCell>
              </TableRow>
            ) : (
              state.announcements.map((announcement) => (
                <TableRow
                  key={announcement.sent_at}
                  className="cursor-pointer hover:bg-neutral-50"
                  role="button"
                  tabIndex={0}
                  onClick={() => actions.openEdit(announcement)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      actions.openEdit(announcement)
                    }
                  }}
                >
                  <TableCell className="text-sm whitespace-nowrap text-neutral-500">
                    {formatAnnouncementPostedAt(announcement.sent_at)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    <p className="line-clamp-2 whitespace-normal">
                      {announcement.content}
                    </p>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
