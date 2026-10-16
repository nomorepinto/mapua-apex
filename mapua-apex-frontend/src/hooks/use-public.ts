import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { ApiAnnouncement } from "@/lib/dynamodb-adapters"

export interface PublicOrganization {
  organization_id: string
  name: string | null
}

export function usePublicAnnouncementsQuery() {
  return useQuery({
    queryKey: ["public-announcements"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiAnnouncement[] }>("/public/announcements")
      return res.data
    },
  })
}

export function usePublicOrganizationsQuery() {
  return useQuery({
    queryKey: ["public-organizations"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: PublicOrganization[] }>(
        "/public/organizations"
      )
      return res.data
    },
  })
}
