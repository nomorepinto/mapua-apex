import type { ActionFunctionArgs } from "react-router"

import type { SubmissionActionData } from "@/components/submission/types"
import { apiClient, ApiError } from "@/lib/api-client"
import { buildSaafApiPayload, omitEventIdFromPayload } from "@/lib/dynamodb-adapters"
import { queryClient } from "@/main"
import { SUBMISSION_KEYS } from "@/hooks/use-submissions"
import { useOrgStore } from "@/stores/org-store"

export async function action({
  request,
}: ActionFunctionArgs): Promise<SubmissionActionData> {
  const formData = await request.formData()
  const data = Object.fromEntries(formData.entries())

  if (!data.activityType) {
    return {
      success: false,
      message: "Please select an activity classification",
      errors: { activityType: "Please select an activity classification" },
    }
  }

  const saafDraft = useOrgStore.getState().saafDraft
  const reservationDraft = useOrgStore.getState().reservationDraft
  // The edit ids live in the store once hydration loads a returned paper, but
  // the route's `?event=&submission=` params are the authoritative fallback so a
  // resubmit still PUTs (never POSTs a duplicate) if hydration has not run yet.
  const url = new URL(request.url)
  const editingEventId =
    useOrgStore.getState().editingEventId ?? url.searchParams.get("event")
  const editingSubmissionId =
    useOrgStore.getState().editingSubmissionId ??
    url.searchParams.get("submission")

  if (!saafDraft) {
    return {
      success: false,
      message: "Form draft is missing. Please complete the activity application before submitting.",
      errors: { activityType: "Form draft is missing" },
    }
  }

  try {
    const payload = buildSaafApiPayload(
      saafDraft,
      reservationDraft,
      editingEventId ?? undefined
    )

    if (editingEventId && editingSubmissionId) {
      await apiClient.put(
        `/students/events/${editingEventId}/submissions/${editingSubmissionId}`,
        omitEventIdFromPayload(payload)
      )
    } else {
      await apiClient.post("/students/submissions", payload)
    }

    useOrgStore.getState().clearSaafDraft()
    useOrgStore.getState().clearReservationDraft()
    useOrgStore.getState().clearSubmissionStart()
    useOrgStore.getState().clearEditingSubmission()

    // Invalidate server queries
    queryClient.invalidateQueries({ queryKey: SUBMISSION_KEYS.all })

    return {
      success: true,
      message: "Activity Application Submitted Successfully!",
    }
  } catch (error) {
    console.error("Submission failed:", error)
    // A 409 means a chosen slot was taken between availability check and write.
    // Nothing was persisted, so surface the conflict through the same failure
    // channel and keep the draft intact for the submitter to pick another time.
    if (error instanceof ApiError && error.status === 409) {
      return {
        success: false,
        message:
          error.message ||
          "A selected slot was just booked by someone else. Your submission was not created — pick another time and try again.",
      }
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to submit application. Please try again.",
    }
  }
}

