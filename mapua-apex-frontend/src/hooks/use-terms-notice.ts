import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

/**
 * Mirror of the backend `TermsNotice` shape served by
 * `GET /api/v2/public/terms-notice`. The notice text and version are the
 * authority the proponent consents against, so they are read from the server
 * rather than duplicated in the client.
 */
export type ApiTermsNotice = {
  version: string
  effective_date: string
  title: string
  intro: string
  turnaround_time: string
  filing_window: string
  major_event_criteria: string[]
  minor_event_criteria: string[]
  acknowledgements: string[]
}

/** Public, unauthenticated read of the current SAAF T&C notice (same caching shape as the privacy notice read). */
export function useTermsNoticeQuery() {
  return useQuery({
    queryKey: ["public-terms-notice"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiTermsNotice | null }>("/public/terms-notice")
      return res.data ?? null
    },
    staleTime: Infinity,
  })
}