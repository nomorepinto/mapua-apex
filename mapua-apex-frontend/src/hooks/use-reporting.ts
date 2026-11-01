import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { useAuth } from "react-oidc-context"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  dateRangeError,
  publicFilterState,
  restoreFilters,
  filterRecords,
  facetOptions,
  type ReportRecord,
  type ReportFilters,
  type ReportKind,
  type ReportPayload,
} from "@/lib/reporting"

export function useReportFilters(
  kind: ReportKind,
  namespace: string,
  initial: ReportFilters = {}
) {
  const [defaults] = useState<ReportFilters>(() => ({
    sort: "desc",
    ...initial,
  }))
  const [params, setParams] = useSearchParams()
  const [privateState, setPrivateFilters] = useState<{
    namespace: string
    search?: string
    actors?: string[]
    paths?: string[]
  }>({ namespace })
  const serialized = params.get(`${namespace}.filters`)
  const filters = useMemo<ReportFilters>(() => {
    const restored = restoreFilters(kind, serialized, defaults)
    const publicFilters =
      (kind === "sessions" || kind === "activity") &&
      dateRangeError(restored, true)
        ? defaults
        : restored
    const privateFilters: Partial<typeof privateState> =
      privateState.namespace === namespace ? privateState : {}
    return {
      ...publicFilters,
      search: privateFilters.search,
      values: {
        ...publicFilters.values,
        ...(privateFilters.actors?.length
          ? { actor_id: privateFilters.actors }
          : {}),
        ...(privateFilters.paths?.length ? { path: privateFilters.paths } : {}),
      },
    }
  }, [kind, serialized, defaults, privateState, namespace])
  const setFilters = useCallback(
    (next: ReportFilters) => {
      if (dateRangeError(next, kind === "sessions" || kind === "activity"))
        return
      setPrivateFilters({
        namespace,
        search: next.search,
        actors: next.values?.actor_id,
        paths: next.values?.path,
      })
      setParams((current) => {
        const updated = new URLSearchParams(current)
        updated.set(
          `${namespace}.filters`,
          JSON.stringify(publicFilterState(next))
        )
        return updated
      })
    },
    [kind, namespace, setParams]
  )
  return { filters, setFilters, reset: () => setFilters(defaults) }
}

export function useReportScope(): readonly unknown[] {
  const { user } = useAuth()
  return [
    user?.profile.sub,
    user?.profile["cognito:groups"],
    user?.profile["custom:organization_id"],
    user?.profile["custom:signatory_id"],
  ]
}

const EMPTY_RECORDS: never[] = []
export function useLocalReport<T extends object>(
  kind: ReportKind,
  namespace: string,
  records: T[] = EMPTY_RECORDS,
  initial: ReportFilters = {}
) {
  const state = useReportFilters(kind, namespace, initial)
  const rows = useMemo(
    () => filterRecords(kind, records, state.filters),
    [kind, records, state.filters]
  )
  const options = useMemo(() => facetOptions(kind, records), [kind, records])
  return { ...state, rows, options }
}

/** Shared applied filters for an existing collection table and its reports. */
export function useReportTable<T extends object = ReportRecord>(
  kind: ReportKind,
  endpoint: string,
  namespace: string,
  initial: ReportFilters = {}
) {
  const state = useReportFilters(kind, namespace, initial)
  const bounded = kind === "sessions" || kind === "activity"
  const sourceFilters = bounded
    ? {
        start_date: state.filters.start_date,
        end_date: state.filters.end_date,
        sort: state.filters.sort,
      }
    : {}
  const query = useReportCollection<T>(kind, endpoint, sourceFilters)
  const records = useMemo(
    () => (query.isError ? [] : (query.data ?? [])),
    [query.data, query.isError]
  )
  const rows = useMemo(
    () => filterRecords(kind, records, state.filters),
    [kind, records, state.filters]
  )
  const options = useMemo(() => facetOptions(kind, records), [kind, records])
  return { ...state, query, rows, records, options, endpoint, kind }
}

export function useReportPagination(filters: ReportFilters, count: number) {
  const [pageSize, setSize] = useState(25)
  const [page, setPage] = useState(1)
  const fingerprint = JSON.stringify(filters)
  const [previous, setPrevious] = useState(fingerprint)
  if (previous !== fingerprint) {
    setPrevious(fingerprint)
    setPage(1)
  }
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  return {
    pageSize,
    currentPage: Math.min(page, totalPages),
    totalPages,
    setCurrentPage: setPage,
    setPageSize: (size: number) => {
      setSize(size)
      setPage(1)
    },
  }
}

/** Never exposes a partial collection after a failed page or cancellation. */
export async function fetchReportCollection<T extends object>(
  endpoint: string,
  filters: ReportFilters,
  signal?: AbortSignal
): Promise<T[]> {
  const records: T[] = []
  const tokens = new Set<string>()
  let token: string | undefined
  do {
    signal?.throwIfAborted()
    const result = await apiClient.get<{
      data: T[]
      nextToken?: string | null
    }>(endpoint, {
      signal,
      cache: "no-store",
      params: {
        filters: JSON.stringify(filters),
        limit: 200,
        nextToken: token,
      },
    })
    if (!Array.isArray(result.data))
      throw new Error("The server did not return a complete collection.")
    records.push(...result.data)
    token = result.nextToken ?? undefined
    if (token && tokens.has(token))
      throw new Error("Retrieval could not continue. Refresh and try again.")
    if (token) tokens.add(token)
  } while (token)
  return records
}

export function useReportCollection<T extends object>(
  kind: ReportKind,
  endpoint: string,
  filters: ReportFilters,
  enabled = true
) {
  const scope = useReportScope()
  return useQuery({
    queryKey: ["report-collection", kind, endpoint, filters, scope],
    queryFn: ({ signal }) =>
      fetchReportCollection<T>(endpoint, filters, signal),
    enabled: enabled && !dateRangeError(filters),
    gcTime: 0,
    retry: false,
  })
}

export function useReportSummary(
  kind: ReportKind,
  endpoint: string,
  filters: ReportFilters,
  enabled = true
) {
  const scope = useReportScope()
  return useQuery({
    queryKey: ["report-summary", kind, endpoint, filters, scope],
    queryFn: async ({ signal }) =>
      (
        await apiClient.post<{ data: ReportPayload }>(
          `${endpoint}/report`,
          { filters, sections: ["summary", "breakdowns"] },
          { signal, cache: "no-store" }
        )
      ).data,
    enabled: enabled && !dateRangeError(filters, true),
    gcTime: 0,
    retry: false,
  })
}
