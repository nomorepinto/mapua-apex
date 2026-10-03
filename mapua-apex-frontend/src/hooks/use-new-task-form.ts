import { useCallback, useState, type FormEvent } from "react"

import { useOrgStore } from "@/stores/org-store"

function formatDueDate(value: string) {
  if (!value) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function useNewTaskForm(onClose: () => void) {
  const addMilestoneTask = useOrgStore((state) => state.addMilestoneTask)
  const [title, setTitle] = useState("")
  const [responsible, setResponsible] = useState("")
  const [dueDate, setDueDate] = useState("")

  const canSubmit = Boolean(title.trim())

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      if (!title.trim()) return
      addMilestoneTask(title.trim(), responsible.trim(), formatDueDate(dueDate))
      setTitle("")
      setResponsible("")
      setDueDate("")
      onClose()
    },
    [addMilestoneTask, dueDate, onClose, responsible, title]
  )

  return {
    title,
    setTitle,
    responsible,
    setResponsible,
    dueDate,
    setDueDate,
    canSubmit,
    handleSubmit,
  }
}
