import { X, Bell, Clock, AlertTriangle, CheckCircle } from "lucide-react"

import { useDeadlineNotifications } from "@/hooks/use-deadline-notifications"
import { useOrgStore } from "@/stores/org-store"
import { formatDocumentId } from "@/lib/dynamodb-adapters"
import { layout, modal } from "@/config"
import { cn } from "@/lib/utils"

interface NotificationsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const submissions = useOrgStore((state) => state.submissions)
  const notifications = useDeadlineNotifications(submissions)

  if (!isOpen) return null

  return (
    <div className={modal.popoverOverlay}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 sm:bg-transparent"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        className={modal.popoverShell}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 bg-[#F8FAFC] px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#1E293B]" />
            <h2 className="text-sm font-bold text-[#1E293B]">Notifications & Reminders</h2>
          </div>
          <button
            onClick={onClose}
            className={modal.close}
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(24rem,60dvh)] overflow-y-auto p-2 sm:max-h-[400px]">
          {notifications.length === 0 ? (
            <div className={cn(layout.empty, "p-8")}>
              <CheckCircle className="w-8 h-8 text-neutral-300 mb-2" />
              <p className="text-sm font-medium text-neutral-500">You're all caught up!</p>
              <p className="text-xs text-neutral-400 mt-1">No pressing deadlines right now.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {notifications.map(({ sub, diffDays }) => (
                <div key={sub.id} className="p-3 hover:bg-neutral-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-neutral-100">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${diffDays < 3 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                      {diffDays < 3 ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-[#1E293B] leading-tight">{sub.activity_details.title}</h4>
                      <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-2">
                        {formatDocumentId(sub.id)} is currently {sub.status} with {sub.current_signatory}.
                      </p>
                      <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md ${diffDays < 0 ? 'bg-red-100 text-red-700' : (diffDays < 3 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600')}`}>
                        {diffDays < 0 ? `Overdue by ${Math.abs(diffDays)} days` : (diffDays === 0 ? 'Due Today' : `Due in ${diffDays} days`)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
