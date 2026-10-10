import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { Announcement } from "@/lib/types"

export function usePublicAnnouncementsQuery() {
  return useQuery({
    queryKey: ["public-announcements"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Announcement[] }>("/public/announcements")
      return res.data
    },
  })
}
