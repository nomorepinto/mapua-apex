import { useCallback, useState } from "react"

import type { Submission } from "@/stores/org-store"
import { useOrgStore } from "@/stores/org-store"

export function useOrgDashboard() {
  const [isMilestoneOpen, setIsMilestoneOpen] = useState(false)
  const [isNewEventOpen, setIsNewEventOpen] = useState(false)
  const [isTrackerOpen, setIsTrackerOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const selectedDate = useOrgStore((state) => state.selectedDate)
  const setSelectedDate = useOrgStore((state) => state.setSelectedDate)
  const calendarEvents = useOrgStore((state) => state.calendarEvents)
  const milestoneTasks = useOrgStore((state) => state.milestoneTasks)
  const activities = useOrgStore((state) => state.activities)
  const logActivity = useOrgStore((state) => state.logActivity)

  const openMilestone = useCallback(() => setIsMilestoneOpen(true), [])
  const closeMilestone = useCallback(() => setIsMilestoneOpen(false), [])
  const openNewEvent = useCallback(() => setIsNewEventOpen(true), [])
  const closeNewEvent = useCallback(() => setIsNewEventOpen(false), [])
  const closeNotifications = useCallback(() => setIsNotificationsOpen(false), [])

  const closeTracker = useCallback(() => {
    setIsTrackerOpen(false)
    setTimeout(() => setSelectedSubmission(null), 200)
  }, [])

  const handleResourceAccess = useCallback(
    (title: string, description: string) => {
      logActivity(title, description, "info")
    },
    [logActivity]
  )

  return {
    isMilestoneOpen,
    isNewEventOpen,
    isTrackerOpen,
    selectedSubmission,
    isNotificationsOpen,
    selectedDate,
    setSelectedDate,
    calendarEvents,
    milestoneTasks,
    activities,
    openMilestone,
    closeMilestone,
    openNewEvent,
    closeNewEvent,
    closeTracker,
    closeNotifications,
    handleResourceAccess,
  }
}
