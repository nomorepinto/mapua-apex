import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { ApiMember, CreateMemberPayload } from "@/lib/dynamodb-adapters"
import { mutationErrorMessage } from "@/hooks/use-admin"

export const MEMBER_KEYS = {
  members: ["student-members"] as const,
}

/**
 * Fetch all members belonging to the logged-in student's organization.
 */
export function useMembersQuery() {
  return useQuery({
    queryKey: MEMBER_KEYS.members,
    queryFn: async () => {
      const res = await apiClient.get<{ data: ApiMember[] }>("/students/members")
      return res.data || []
    },
  })
}

/**
 * Add a single member to the organization.
 */
export function useCreateMemberMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateMemberPayload) => {
      const res = await apiClient.post<{ data: ApiMember }>("/students/members", payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBER_KEYS.members })
    },
  })
}

export type BulkMemberResult = {
  created: ApiMember[]
  failed: Array<{ student_number: string; error: string }>
}

/**
 * Bulk-create members via the dedicated backend endpoint.
 */
export function useBulkCreateMembersMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (members: CreateMemberPayload[]): Promise<BulkMemberResult> => {
      const res = await apiClient.post<BulkMemberResult>("/students/members/bulk", { members })
      return res
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MEMBER_KEYS.members })
    },
  })
}

/**
 * Update a member's lastname/firstname.
 */
export function useUpdateMemberMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      studentId,
      lastname,
      firstname,
    }: { studentId: string; lastname: string; firstname: string }) => {
      const res = await apiClient.put<{ data: ApiMember }>(
        `/students/members/${studentId}`,
        { lastname, firstname }
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBER_KEYS.members })
    },
  })
}

/**
 * Remove a member from the organization.
 */
export function useDeleteMemberMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (studentId: string) => {
      await apiClient.delete(`/students/members/${studentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBER_KEYS.members })
    },
  })
}

export { mutationErrorMessage }
