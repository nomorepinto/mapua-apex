import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { RecordTimeline } from "@/components/reports/record-timeline"
import { sessionTimeline } from "@/lib/timeline-reporting"
import { SessionStatusBadge } from "./session-status-badge"
import type { Session } from "@/types/logs"
import { LoadingBlock } from "@/components/ui/loading-block"
import { formatManila } from "@/lib/monitor-formatters"
import { SessionRoleBadge } from "./session-role-badge"

interface SessionDetailModalProps {
  sessionId: string | null
  session?: Session | null
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onClose: () => void
}

export function SessionDetailModal({
  sessionId,
  session,
  isLoading,
  isError,
  onRetry,
  onClose,
}: SessionDetailModalProps) {
  if (!sessionId) return null

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Session Details</DialogTitle>
          <DialogDescription>{sessionId}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {isError ? (
            <div role="alert" className="space-y-2 text-sm text-red-700">
              The session timeline could not be retrieved. No partial report is
              available.
              {onRetry && (
                <Button variant="outline" onClick={onRetry}>
                  Retry timeline
                </Button>
              )}
            </div>
          ) : isLoading ? (
            <LoadingBlock
              label="Loading session timeline"
              rowClassName="h-16 w-full"
            />
          ) : session ? (
            <div className="space-y-6">
              {/* Identity Card */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs">
                <div>
                  <span className="block font-medium text-neutral-400">
                    User Name
                  </span>
                  <span className="text-sm font-bold text-neutral-900">
                    {session.userName}
                  </span>
                </div>
                <div>
                  <span className="block font-medium text-neutral-400">
                    Email
                  </span>
                  <span className="font-semibold text-neutral-800">
                    {session.userEmail}
                  </span>
                </div>
                <div>
                  <span className="block font-medium text-neutral-400">
                    Role
                  </span>
                  <SessionRoleBadge
                    role={session.userRole}
                    email={session.userEmail}
                    userName={session.userName}
                  />
                </div>
                <div>
                  <span className="block font-medium text-neutral-400">
                    IP Address
                  </span>
                  <span className="font-mono font-medium text-neutral-700">
                    {session.ipAddress}
                  </span>
                </div>
                <div>
                  <span className="block font-medium text-neutral-400">
                    Time In
                  </span>
                  <span className="font-medium text-neutral-800">
                    {formatManila(session.timeIn)}
                  </span>
                </div>
                <div>
                  <span className="block font-medium text-neutral-400">
                    Time Out
                  </span>
                  <span className="font-medium text-neutral-800">
                    {session.timeOut ? formatManila(session.timeOut) : "—"}
                  </span>
                </div>
                <div className="col-span-2 border-t border-neutral-200/60 pt-2">
                  <span className="block font-medium text-neutral-400">
                    Session Status
                  </span>
                  <SessionStatusBadge session={session} />
                </div>
              </div>

              {/* Pages Visited Timeline */}
              <RecordTimeline
                key={sessionId}
                kind="session_timeline"
                source={sessionTimeline(session)}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Session not available.</p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
