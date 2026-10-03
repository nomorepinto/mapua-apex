import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError, apiClient } from "@/lib/api-client"
import {
  announcementPath,
  type ApiAnnouncement,
  type ApiNotification,
  type ApiOrganization,
  type ApiSignatory,
  type ApiSubmission,
  type CreateOrganizationPayload,
  type CreateSignatoryPayload,
} from "@/lib/dynamodb-adapters"

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export const ADMIN_KEYS = {
  submissions: (params?: Record<string, string | undefined>) =>
    ["admin-submissions", params] as const,
  submissionDetail: (eventId: string, submissionId: string) =>
    ["admin-submission-detail", eventId, submissionId] as const,
  organizations: ["admin-organizations"] as const,
  signatories: ["admin-signatories"] as const,
  announcements: ["admin-announcements"] as const,
}

/**
 * Fetch all submissions system-wide with optional filters
 */
export function useAdminSubmissionsQuery(params?: {
  status?: "pending" | "approved" | "denied" | "returned"
  activity_type?: string
  organization_id?: string
}) {
  return useQuery({
    queryKey: ADMIN_KEYS.submissions(params),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiSubmission[] }>("/admins/submissions", {
        params,
      })
      return res.data || []
    },
  })
}

/**
 * Fetch full submission document + notifications for admin
 */
export function useAdminSubmissionDetailQuery(eventId?: string, submissionId?: string) {
  return useQuery({
    queryKey: ADMIN_KEYS.submissionDetail(eventId || "", submissionId || ""),
    queryFn: async () => {
      if (!eventId || !submissionId) throw new Error("Event ID and Submission ID required")
      const res = await apiClient.get<{
        data: ApiSubmission & {
          notifications: ApiNotification[]
        }
      }>(`/admins/events/${eventId}/submissions/${submissionId}`)
      return res.data
    },
    enabled: Boolean(eventId && submissionId),
  })
}

export function useAdminAnnouncementsQuery() {
  return useQuery({
    queryKey: ADMIN_KEYS.announcements,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiAnnouncement[] }>("/admins/announcements")
      return res.data || []
    },
  })
}

export function useCreateAnnouncementMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await apiClient.post<{ data: ApiAnnouncement }>("/admins/announcements", {
        content,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.announcements })
    },
  })
}

export function useUpdateAnnouncementMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sentAt, content }: { sentAt: string; content: string }) => {
      const res = await apiClient.put<{ data: ApiAnnouncement }>(
        announcementPath(sentAt),
        { content }
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.announcements })
    },
  })
}

export function useDeleteAnnouncementMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sentAt: string) => {
      await apiClient.delete(announcementPath(sentAt))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.announcements })
    },
  })
}

/**
 * Fetch all registered organizations
 */
export function useOrganizationsQuery() {
  return useQuery({
    queryKey: ADMIN_KEYS.organizations,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiOrganization[] }>("/admins/organizations")
      return res.data || []
    },
  })
}

/**
 * Create a new organization
 */
export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateOrganizationPayload) => {
      const res = await apiClient.post<{ data: ApiOrganization }>(
        "/admins/organizations",
        payload
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.organizations })
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.signatories })
    },
  })
}

export function useUpdateOrganizationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      organizationId,
      ...payload
    }: CreateOrganizationPayload & { organizationId: string }) => {
      const res = await apiClient.put<{ data: ApiOrganization }>(
        `/admins/organizations/${organizationId}`,
        payload
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.organizations })
    },
  })
}

export type BulkCreateResult<T extends { name: string }> = {
  created: T[]
  failed: Array<{ name: string; error: string }>
}

/**
 * Create many organizations sequentially (no bulk admin endpoint).
 */
export function useBulkCreateOrganizationsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      payloads: CreateOrganizationPayload[]
    ): Promise<BulkCreateResult<ApiOrganization>> => {
      const created: ApiOrganization[] = []
      const failed: Array<{ name: string; error: string }> = []

      for (const payload of payloads) {
        try {
          const res = await apiClient.post<{ data: ApiOrganization }>(
            "/admins/organizations",
            payload
          )
          created.push(res.data)
        } catch (error) {
          failed.push({
            name: payload.name,
            error: mutationErrorMessage(error, "Could not create organization."),
          })
        }
      }

      return { created, failed }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.organizations })
    },
  })
}

/**
 * Fetch all registered signatories
 */
export function useSignatoriesQuery() {
  return useQuery({
    queryKey: ADMIN_KEYS.signatories,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiSignatory[] }>("/admins/signatories")
      return res.data || []
    },
  })
}

/**
 * Create a new signatory
 */
export function useCreateSignatoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateSignatoryPayload) => {
      const res = await apiClient.post<{ data: ApiSignatory }>(
        "/admins/signatories",
        payload
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.signatories })
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.organizations })
    },
  })
}

/**
 * Update an existing signatory
 */
export function useUpdateSignatoryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      signatoryId,
      ...payload
    }: {
      signatoryId: string
    } & CreateSignatoryPayload) => {
      const res = await apiClient.put<{ data: ApiSignatory }>(
        `/admins/signatories/${signatoryId}`,
        payload
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.signatories })
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.organizations })
    },
  })
}

/**
 * Create many signatories sequentially (no bulk admin endpoint).
 */
export function useBulkCreateSignatoriesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      payloads: CreateSignatoryPayload[]
    ): Promise<BulkCreateResult<ApiSignatory>> => {
      const created: ApiSignatory[] = []
      const failed: Array<{ name: string; error: string }> = []

      for (const payload of payloads) {
        try {
          const res = await apiClient.post<{ data: ApiSignatory }>(
            "/admins/signatories",
            payload
          )
          created.push(res.data)
        } catch (error) {
          failed.push({
            name: `${payload.name} (${payload.role})`,
            error: mutationErrorMessage(error, "Could not create signatory."),
          })
        }
      }

      return { created, failed }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.signatories })
    },
  })
}
