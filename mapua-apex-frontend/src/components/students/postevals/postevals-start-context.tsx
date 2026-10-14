/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { use } from "react"
import { useNavigate } from "react-router"

import { DEFAULT_POST_EVAL_DRAFT } from "@/components/posteval/constants"
import { useEligiblePostEvalEventsQuery } from "@/hooks/use-postevals"
import type { ApiEligiblePostEvalEvent } from "@/lib/dynamodb-adapters"
import { useOrgStore } from "@/stores/org-store"

interface PostEvalsStartState {
  selectedEventId: string
  error: string | null
  guideOpen: boolean
  events: ApiEligiblePostEvalEvent[]
  isLoading: boolean
  loadError: boolean
}

interface PostEvalsStartActions {
  changeEvent: (eventId: string) => void
  submit: (event: FormEvent) => void
  setGuideOpen: (open: boolean) => void
}

interface PostEvalsStartContextValue {
  state: PostEvalsStartState
  actions: PostEvalsStartActions
}

const PostEvalsStartContext =
  createContext<PostEvalsStartContextValue | null>(null)

export function usePostEvalsStart() {
  const value = use(PostEvalsStartContext)
  if (!value) {
    throw new Error(
      "usePostEvalsStart must be used within PostEvalsStartProvider"
    )
  }
  return value
}

/**
 * Step-1 of the post-eval flow: pick a passed, still-in-window event. On
 * continue the selection seeds the persisted `postEvalDraft` and the wizard
 * opens. An in-progress draft for the same event is preserved; choosing a
 * different event starts fresh.
 */
export function PostEvalsStartProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const savedEventId = useOrgStore(
    (state) => state.postEvalDraft?.selectedEventId ?? ""
  )
  const {
    data: events = [],
    isPending,
    isError,
  } = useEligiblePostEvalEventsQuery()
  const [selectedEventId, setSelectedEventId] = useState(savedEventId)
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)

  const value: PostEvalsStartContextValue = {
    state: {
      selectedEventId,
      error,
      guideOpen,
      events,
      isLoading: isPending,
      loadError: isError,
    },
    actions: {
      changeEvent: (next) => {
        setSelectedEventId(next)
        setError(null)
      },
      setGuideOpen,
      submit: (event) => {
        event.preventDefault()
        const selected = events.find((item) => item.event_id === selectedEventId)

        if (!selected) {
          setError("Select an event to post-evaluate.")
          return
        }

        const existing = useOrgStore.getState().postEvalDraft
        const base =
          existing && existing.selectedEventId === selected.event_id
            ? existing
            : DEFAULT_POST_EVAL_DRAFT

        useOrgStore.getState().setPostEvalDraft({
          ...base,
          selectedEventId: selected.event_id,
          selectedSubmissionId: selected.submission_id,
          eventTitle: selected.event_title || "",
        })
        navigate("/students/postevals/wizard")
      },
    },
  }

  return (
    <PostEvalsStartContext value={value}>{children}</PostEvalsStartContext>
  )
}
