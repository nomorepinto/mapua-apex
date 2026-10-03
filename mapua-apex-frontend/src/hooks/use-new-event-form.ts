import { useCallback, useState } from "react"

import { getDateKey, minEventDateKey, parseDateKey } from "@/lib/date-key"
import { useOrgStore } from "@/stores/org-store"

function initialEventDate(defaultDate: Date | undefined): string {
  const minDate = minEventDateKey()
  if (!defaultDate) return minDate
  const next = getDateKey(defaultDate)
  return next < minDate ? minDate : next
}

export function useNewEventForm(defaultDate: Date | undefined, onClose: () => void) {
  const addCalendarEvent = useOrgStore((state) => state.addCalendarEvent)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(() => initialEventDate(defaultDate))

  const canSubmit = Boolean(title.trim() && date)

  const handleSubmit = useCallback(
    (event?: { preventDefault: () => void }) => {
      event?.preventDefault()
      const eventDate = parseDateKey(date)
      if (!title.trim() || !eventDate) return
      addCalendarEvent(eventDate, title.trim())
      setTitle("")
      onClose()
    },
    [addCalendarEvent, date, onClose, title]
  )

  return { title, setTitle, date, setDate, canSubmit, handleSubmit }
}
