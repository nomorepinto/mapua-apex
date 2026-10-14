/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  useApprovePostEvalMutation,
  useDenyPostEvalMutation,
  useOsaarPostEvalsQuery,
} from "@/hooks/use-postevals"
import { ApiError } from "@/lib/api-client"
import type { ApiPostEval } from "@/lib/dynamodb-adapters"

/** Identifies a single post-eval by its composite (event + post-eval) key. */
export interface PostEvalSelection {
  eventId: string
  postevalId: string
}

interface PostEvalsReviewContextValue {
  /** Every post-eval across all organizations, as returned by the admin scan. */
  postEvals: ApiPostEval[]
  isLoading: boolean
  isError: boolean
  /** The post-eval whose review dialog is open (null = closed). */
  selected: PostEvalSelection | null
  selectPostEval: (selection: PostEvalSelection | null) => void
  /** Approve → post-eval `approved` + linked submission `finished`. */
  approve: (selection: PostEvalSelection) => Promise<void>
  /** Deny → post-eval `denied`; the linked submission stays `approved`. */
  deny: (selection: PostEvalSelection) => Promise<void>
  isActing: boolean
  actionError: string | null
  clearActionError: () => void
}

const PostEvalsReviewContext = createContext<PostEvalsReviewContextValue | null>(null)

/**
 * State container for the OSAAR post-evaluation review desk. Owns the
 * cross-organization queue query, the currently-open post-eval, and the
 * approve/deny mutations. Approving also transitions the linked submission to
 * `finished`, so the mutation hook invalidates the admin submission cache too.
 */
export function PostEvalsReviewProvider({ children }: { children: ReactNode }) {
  const { data, isPending, isError } = useOsaarPostEvalsQuery()
  const approveMutation = useApprovePostEvalMutation()
  const denyMutation = useDenyPostEvalMutation()

  const [selected, setSelected] = useState<PostEvalSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selectPostEval = useCallback((selection: PostEvalSelection | null) => {
    setSelected(selection)
    // Opening a fresh post-eval (or closing) clears any stale action error.
    setActionError(null)
  }, [])

  const clearActionError = useCallback(() => setActionError(null), [])

  const runAction = useCallback(
    async (
      mutate: (selection: PostEvalSelection) => Promise<unknown>,
      selection: PostEvalSelection,
      failureMessage: string
    ) => {
      setActionError(null)
      try {
        await mutate(selection)
        // Success closes the dialog; the queue/detail caches refresh via the hook.
        setSelected(null)
      } catch (error) {
        setActionError(
          error instanceof ApiError && error.message ? error.message : failureMessage
        )
      }
    },
    []
  )

  const approve = useCallback(
    (selection: PostEvalSelection) =>
      runAction(
        (sel) => approveMutation.mutateAsync(sel),
        selection,
        "Could not approve this post-evaluation."
      ),
    [approveMutation, runAction]
  )

  const deny = useCallback(
    (selection: PostEvalSelection) =>
      runAction(
        (sel) => denyMutation.mutateAsync(sel),
        selection,
        "Could not deny this post-evaluation."
      ),
    [denyMutation, runAction]
  )

  const value = useMemo<PostEvalsReviewContextValue>(
    () => ({
      postEvals: data ?? [],
      isLoading: isPending,
      isError,
      selected,
      selectPostEval,
      approve,
      deny,
      isActing: approveMutation.isPending || denyMutation.isPending,
      actionError,
      clearActionError,
    }),
    [
      data,
      isPending,
      isError,
      selected,
      selectPostEval,
      approve,
      deny,
      approveMutation.isPending,
      denyMutation.isPending,
      actionError,
      clearActionError,
    ]
  )

  return (
    <PostEvalsReviewContext.Provider value={value}>
      {children}
    </PostEvalsReviewContext.Provider>
  )
}

export function usePostEvalsReview(): PostEvalsReviewContextValue {
  const context = useContext(PostEvalsReviewContext)
  if (!context) {
    throw new Error(
      "usePostEvalsReview must be used within a PostEvalsReviewProvider"
    )
  }
  return context
}
