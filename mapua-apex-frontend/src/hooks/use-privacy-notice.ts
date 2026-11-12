import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

/**
 * Mirror of the backend `PrivacyNotice` shape served by
 * `GET /api/v2/public/privacy-notice`. The notice text and version are the
 * authority the proponent consents against, so they are read from the server
 * rather than duplicated in the client.
 */
export type ApiPrivacyNotice = {
  version: string
  effective_date: string
  title: string
  intro: string
  collection: string[]
  purposes: string[]
  sharing: string[]
  rights: string[]
  contact: string
}

/** Public, unauthenticated read of the current RA 10173 notice (same caching shape as the public term read). */
export function usePrivacyNoticeQuery() {
  return useQuery({
    queryKey: ["public-privacy-notice"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiPrivacyNotice | null }>("/public/privacy-notice")
      return res.data ?? null
    },
    staleTime: Infinity,
  })
}
