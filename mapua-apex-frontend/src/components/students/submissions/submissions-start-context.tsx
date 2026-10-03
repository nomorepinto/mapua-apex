/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { use } from "react"
import { useNavigate } from "react-router"

import { DEFAULT_SAAF_DRAFT } from "@/components/submission/constants"
import { useOrgStore } from "@/stores/org-store"

interface SubmissionsStartState {
  eventName: string
  reserveFacilities: "yes" | "no" | ""
  error: string | null
  guideOpen: boolean
}

interface SubmissionsStartActions {
  changeEventName: (value: string) => void
  changeReserveFacilities: (value: "yes" | "no" | "") => void
  submit: (event: FormEvent) => void
  setGuideOpen: (open: boolean) => void
}

interface SubmissionsStartContextValue {
  state: SubmissionsStartState
  actions: SubmissionsStartActions
}

const SubmissionsStartContext =
  createContext<SubmissionsStartContextValue | null>(null)

export function useSubmissionsStart() {
  const value = use(SubmissionsStartContext)
  if (!value) {
    throw new Error(
      "useSubmissionsStart must be used within SubmissionsStartProvider"
    )
  }
  return value
}

export function SubmissionsStartProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const savedName = useOrgStore((state) => state.eventName)
  const savedChoice = useOrgStore((state) => state.reserveFacilities)
  const [eventName, setEventName] = useState(savedName)
  const [reserveFacilities, setReserveFacilities] = useState<"yes" | "no" | "">(
    savedChoice ?? ""
  )
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)

  const value: SubmissionsStartContextValue = {
    state: { eventName, reserveFacilities, error, guideOpen },
    actions: {
      changeEventName: (next) => {
        setEventName(next)
        setError(null)
      },
      changeReserveFacilities: (next) => {
        setReserveFacilities(next)
        setError(null)
      },
      setGuideOpen,
      submit: (event) => {
        event.preventDefault()
        const name = eventName.trim()
        if (name.length === 0) {
          setError("Enter an event name to continue.")
          return
        }
        if (reserveFacilities !== "yes" && reserveFacilities !== "no") {
          setError("Choose whether you will reserve school facilities.")
          return
        }

        const existingDraft = useOrgStore.getState().saafDraft
        const wasEditing = Boolean(useOrgStore.getState().editingEventId)
        useOrgStore.getState().clearEditingSubmission()
        if (wasEditing) {
          useOrgStore.getState().clearSaafDraft()
          useOrgStore.getState().clearReservationDraft()
        }
        useOrgStore.getState().setSubmissionStart(name, reserveFacilities)
        useOrgStore.getState().setSaafDraft({
          ...DEFAULT_SAAF_DRAFT,
          ...(wasEditing ? {} : (existingDraft ?? {})),
          activityTitle: name,
        })
        navigate("/students/submissions/saaf")
      },
    },
  }

  return (
    <SubmissionsStartContext value={value}>{children}</SubmissionsStartContext>
  )
}
