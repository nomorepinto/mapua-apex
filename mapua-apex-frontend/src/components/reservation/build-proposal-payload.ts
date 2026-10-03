import type { ReservationDraft } from "@/components/reservation/types"
import { buildSaafApiPayload } from "@/lib/dynamodb-adapters"
import { useOrgStore } from "@/stores/org-store"

export function buildCombinedProposalPayload(draft: ReservationDraft) {
  const saafDraft = useOrgStore.getState().saafDraft
  if (!saafDraft) {
    throw new Error("SAAF Draft is required to build proposal payload")
  }
  return buildSaafApiPayload(saafDraft, draft)
}

