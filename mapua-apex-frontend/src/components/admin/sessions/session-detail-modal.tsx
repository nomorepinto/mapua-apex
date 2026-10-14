import { XIcon, LaptopIcon } from "lucide-react";
import type { Session } from "@/types/logs";
import { formatManila } from "@/lib/monitor-formatters";
import { SessionRoleBadge } from "./session-role-badge";

interface SessionDetailModalProps {
  sessionId: string | null;
  session?: Session | null;
  isLoading?: boolean;
  onClose: () => void;
}

export function SessionDetailModal({
  sessionId,
  session,
  isLoading,
  onClose,
}: SessionDetailModalProps) {
  if (!sessionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Session Details</h2>
              <p className="font-mono text-xs text-neutral-400">{sessionId}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-neutral-400">Loading session timeline...</div>
          ) : session ? (
            <div className="space-y-6">
              {/* Identity Card */}
              <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-neutral-400 block font-medium">User Name</span>
                  <span className="font-bold text-neutral-900 text-sm">{session.userName}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Email</span>
                  <span className="font-semibold text-neutral-800">{session.userEmail}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Role</span>
                  <SessionRoleBadge role={session.userRole} email={session.userEmail} userName={session.userName} />
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">IP Address</span>
                  <span className="font-mono font-medium text-neutral-700">{session.ipAddress}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Time In</span>
                  <span className="font-medium text-neutral-800">{formatManila(session.timeIn)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Time Out</span>
                  <span className="font-medium text-neutral-800">
                    {session.timeOut ? formatManila(session.timeOut) : "—"}
                  </span>
                </div>
                <div className="col-span-2 border-t border-neutral-200/60 pt-2">
                  <span className="text-neutral-400 block font-medium">Session Status</span>
                  <span className="font-semibold text-neutral-700">
                    {session.status === "active" || session.status === "no_logout_recorded"
                      ? "Active Session"
                      : session.status === "timed_out"
                      ? `Timed out (${session.endReason || "timed_out"})`
                      : session.status === "revoked"
                      ? `Revoked (${session.endReason || "admin_revoked"})`
                      : `Logged out (${session.endReason || "logout"})`}
                  </span>
                </div>
              </div>

              {/* Pages Visited Timeline */}
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                  <LaptopIcon className="h-4 w-4 text-[#8B0000]" />
                  Pages Visited Timeline ({session.pagesVisited.length})
                </h3>
                <div className="space-y-2 border-l-2 border-neutral-200 ml-2 pl-4">
                  {session.pagesVisited.map((page, idx) => (
                    <div key={idx} className="relative pb-2">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#8B0000] ring-4 ring-white" />
                      <div className="text-xs font-semibold text-neutral-800">{page.pageName}</div>
                      <div className="font-mono text-[10px] text-neutral-400">
                        {page.path} • {formatManila(page.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50/50 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-neutral-200 px-5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-300 transition-colors cursor-pointer"
          >
            Close Modal
          </button>
        </div>
      </div>
    </div>
  );
}
