import { XIcon, FileCheck2Icon } from "lucide-react";
import type { ActivityNotification } from "@/types/logs";
import { formatManila } from "@/lib/monitor-formatters";
import {
  formatActivityId,
  formatEventId,
  resolveUserDisplayName,
  resolveUserGroup,
} from "@/hooks/use-monitor";
import { ActivityBadge } from "./activity-badge";

interface ActivityDetailModalProps {
  notification: ActivityNotification | null;
  onClose: () => void;
}

export function ActivityDetailModal({ notification, onClose }: ActivityDetailModalProps) {
  if (!notification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <FileCheck2Icon className="h-5 w-5 text-[#8B0000]" />
              <h2 className="text-base font-bold text-neutral-900">Activity Log Record Details</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <ActivityBadge type={notification.notif_type} />
                <span className="font-mono text-neutral-500 text-[11px]">{formatManila(notification.sent_at)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-neutral-400 block font-medium">ACTIVITY ID</span>
                  <span className="font-mono font-bold text-neutral-900 text-xs">
                    {notification.activity_id || formatActivityId(undefined, notification.sent_at)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">EVENT ID</span>
                  <span className="font-mono font-bold text-[#8B0000] text-xs">
                    {formatEventId(notification.submission_id)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">USER</span>
                  <span className="font-semibold text-neutral-800 text-sm block">
                    {resolveUserDisplayName(notification)}
                  </span>
                  {notification.userEmail && (
                    <span className="block font-mono text-neutral-500 text-[10px]">{notification.userEmail}</span>
                  )}
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">ROLE / USER GROUP</span>
                  <span className="font-mono font-bold text-neutral-900 text-xs rounded bg-neutral-200/80 px-2 py-0.5 inline-block mt-1">
                    {resolveUserGroup(notification)}
                  </span>
                </div>
                {notification.organization_name &&
                  notification.organization_name !== "N/A" &&
                  notification.organization_name !== "null" &&
                  notification.organization_name !== "undefined" && (
                    <div className="col-span-2 pt-1 border-t border-neutral-100">
                      <span className="text-neutral-400 block font-medium">ORGANIZATION</span>
                      <span className="font-semibold text-neutral-800">{notification.organization_name}</span>
                    </div>
                  )}
              </div>

              <div className="pt-2 border-t border-neutral-200">
                <span className="text-neutral-400 block font-medium mb-1">REMARKS / COMMENT</span>
                <div className="rounded-xl bg-white p-3 border border-neutral-200 text-neutral-800 leading-relaxed font-sans text-xs">
                  {notification.comment || <span className="text-neutral-400 italic">No comment provided.</span>}
                </div>
              </div>
            </div>
          </div>
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
