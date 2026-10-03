import { useEffect } from "react"
import { useSearchParams } from "react-router"

import { useSubmissionDetailQuery } from "@/hooks/use-submissions"
import { apiSubmissionToDrafts } from "@/lib/dynamodb-adapters"
import { useOrgStore } from "@/stores/org-store"

export function useHydrateEditingSubmission() {
  const [searchParams] = useSearchParams()
  const eventId = searchParams.get("event")
  const submissionId = searchParams.get("submission")
  const detailQuery = useSubmissionDetailQuery(
    eventId ?? undefined,
    submissionId ?? undefined
  )

  useEffect(() => {
    if (!detailQuery.data || !eventId || !submissionId) return

    const state = useOrgStore.getState()
    if (
      state.editingEventId === eventId &&
      state.editingSubmissionId === submissionId &&
      state.saafDraft
    ) {
      return
    }

    const drafts = apiSubmissionToDrafts(detailQuery.data)
    state.setSaafDraft(drafts.saaf)
    state.setReservationDraft(drafts.reservation)
    state.setEditingSubmission(eventId, submissionId)
    state.setSubmissionStart(
      drafts.saaf.activityTitle,
      drafts.hasReservation ? "yes" : "no"
    )
    if (drafts.hasReservation) {
      state.setSaafValidated(true)
    }
  }, [detailQuery.data, eventId, submissionId])

  return { eventId, submissionId, isHydrating: detailQuery.isLoading }
}
