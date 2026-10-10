import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { ApiAnnouncement } from "@/lib/dynamodb-adapters"

export function usePublicAnnouncementsQuery() {
  return useQuery({
    queryKey: ["public-announcements"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiAnnouncement[] }>("/public/announcements")
      return res.data
    },
  })
}
