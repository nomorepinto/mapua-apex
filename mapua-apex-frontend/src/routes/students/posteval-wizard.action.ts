import type { PostEvalActionData } from "@/components/posteval/types"
import { POSTEVAL_KEYS } from "@/hooks/use-postevals"
import { apiClient, ApiError } from "@/lib/api-client"
import { buildPostEvalApiPayload } from "@/lib/dynamodb-adapters"
import { queryClient } from "@/lib/query-client"
import { useOrgStore } from "@/stores/org-store"

/**
 * Submits the persisted post-eval draft. The payload is built from the org store
 * (not the form body), mirroring `saaf.action.ts`. On success the draft is
 * cleared and the org post-eval list + eligible-event picker are invalidated so
 * the dashboard and step-1 dropdown reflect the newly filed post-eval.
 */
export async function action(): Promise<PostEvalActionData> {
  const draft = useOrgStore.getState().postEvalDraft

  if (!draft || !draft.selectedEventId || !draft.selectedSubmissionId) {
    return {
      success: false,
      message:
        "No event selected. Please choose an event before submitting your post-evaluation.",
    }
  }

  try {
    const payload = buildPostEvalApiPayload(draft)
    await apiClient.post("/students/postevals", payload)

    useOrgStore.getState().clearPostEvalDraft()

    queryClient.invalidateQueries({ queryKey: POSTEVAL_KEYS.all })
    queryClient.invalidateQueries({ queryKey: POSTEVAL_KEYS.eligibleEvents })

    return {
      success: true,
      message: "Post-Evaluation Submitted Successfully!",
    }
  } catch (error) {
    console.error("Post-evaluation submission failed:", error)
    // 409: a post-eval already exists for this event (filed elsewhere or a race).
    // 422: the evaluation window closed or server-side validation rejected it.
    // Nothing was persisted in either case, so keep the draft for the submitter.
    if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
      return {
        success: false,
        message:
          error.message ||
          (error.status === 409
            ? "A post-evaluation has already been filed for this event."
            : "The post-evaluation could not be submitted. Please review your entries and try again."),
      }
    }
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to submit post-evaluation. Please try again.",
    }
  }
}
