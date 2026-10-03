import type { ActionFunctionArgs } from "react-router"

import type { SubmissionActionData } from "@/components/submission/types"
import { apiClient } from "@/lib/api-client"
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
  const editingEventId = useOrgStore.getState().editingEventId
  const editingSubmissionId = useOrgStore.getState().editingSubmissionId

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
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to submit application. Please try again.",
    }
  }
}

