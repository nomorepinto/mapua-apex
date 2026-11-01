import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../lib/api-client"
import { recordOf, type ReportRecord } from "@/lib/reporting"
import { useReportScope } from "./use-reporting"
import type {
  SessionsResponse,
  SessionDetailResponse,
  ActivitiesResponse,
  ActivityNotification,
  AnalyticsResponse,
  ActivityAnalyticsResponse,
  SessionAnalyticsResponse,
  LogQueryParams,
  Session,
  SessionStatus,
  NotificationType,
  HeatmapCell,
  AnalyticsAlert,
  LoginsByRoleMap,
} from "../types/logs"
import {
  IS_MOCK_MODE,
  getMockSessionsResponse,
  getMockActivitiesResponse,
  getMockSessionDetail,
  getMockAnalyticsResponse,
  getMockActivityAnalytics,
  getMockSessionAnalytics,
} from "../lib/mock-monitor-data"

export function classifySessionRole(
  userRole?: string,
  userEmail?: string,
  userName?: string
): "student" | "signatory" | "admin" {
  const r = (userRole || "").toLowerCase()
  const email = (userEmail || "").toLowerCase()
  const name = (userName || "").toLowerCase()

  if (
    r === "admin" ||
    r.includes("admin") ||
    email.includes("admin") ||
    name.includes("admin")
  ) {
    return "admin"
  }

  if (
    r === "signatory" ||
    r === "signatories" ||
    r === "org_adviser" ||
    r === "adviser" ||
    r === "dean" ||
    r === "osaar" ||
    r === "cdm" ||
    r.includes("adviser") ||
    r.includes("dean") ||
    r.includes("osaar") ||
    r.includes("cdm") ||
    r.includes("signat") ||
    email.includes("adviser") ||
    email.includes("dean") ||
    email.includes("osaar") ||
    email.includes("cdm") ||
    name.includes("adviser") ||
    name.includes("dean") ||
    name.includes("osaar") ||
    name.includes("director")
  ) {
    return "signatory"
  }

  return "student"
}

export function classifySignatorySubtype(
  userRole?: string,
  userEmail?: string,
  userName?: string
): "dean" | "osaar" | "cdm" | "adviser" {
  const r = (userRole || "").toLowerCase()
  const email = (userEmail || "").toLowerCase()
  const name = (userName || "").toLowerCase()

  if (
    r === "dean" ||
    r.includes("dean") ||
    email.includes("dean") ||
    name.includes("dean")
  ) {
    return "dean"
  }
  if (
    r === "osaar" ||
    r.includes("osaar") ||
    email.includes("osaar") ||
    name.includes("osaar")
  ) {
    return "osaar"
  }
  if (
    r === "cdm" ||
    r.includes("cdm") ||
    email.includes("cdm") ||
    name.includes("cdm") ||
    name.includes("director")
  ) {
    return "cdm"
  }
  return "adviser"
}

export function normalizeSessionItem(item: ReportRecord): Session {
  const rawStatus = String(item.status || "").toLowerCase()
  const timeOut =
    String(item.timeOut ?? item.time_out ?? item.logout_time ?? "") || undefined

  const recordedStatuses: readonly string[] = [
    "active",
    "completed",
    "logged_out",
    "timed_out",
    "revoked",
    "expired",
    "no_logout_recorded",
  ]
  const status: SessionStatus = recordedStatuses.includes(rawStatus)
    ? (rawStatus as SessionStatus)
    : "unknown"

  const userRole = String(item.userRole ?? item.user_role ?? "unknown")

  const endReason =
    item.endReason ??
    item.end_reason ??
    item.revocation_reason ??
    (status === "timed_out" ? "timed_out" : undefined)

  return {
    sessionId: String(item.sessionId ?? item.session_id ?? ""),
    userId: String(item.userId ?? item.user_id ?? item.sub ?? ""),
    userName: String(
      item.userName ??
        item.user_name ??
        item.userEmail ??
        item.user_email ??
        "Unknown user"
    ),
    userEmail: String(item.userEmail ?? item.user_email ?? ""),
    userRole,
    timeIn: String(
      item.timeIn ?? item.time_in ?? item.login_time ?? item.created_at ?? ""
    ),
    timeOut,
    endReason: endReason
      ? (String(endReason) as Session["endReason"])
      : undefined,
    ipAddress: String(item.ipAddress ?? item.ip_address ?? "N/A"),
    userAgent: String(item.userAgent ?? item.user_agent ?? "N/A"),
    status,
    pagesVisited: normalizePageVisits(item.pagesVisited ?? item.pages_visited),
    pagesVisitedTruncated: Boolean(
      item.pagesVisitedTruncated ?? item.pages_visited_truncated
    ),
  }
}

function normalizePageVisits(value: unknown): Session["pagesVisited"] {
  return Array.isArray(value)
    ? value.map((entry: unknown) => {
        const p = recordOf(entry)
        return {
          path: typeof entry === "string" ? entry : String(p.path ?? ""),
          pageName:
            typeof entry === "string"
              ? entry
              : String(p.pageName ?? p.page_name ?? p.path ?? ""),
          timestamp: String(p.timestamp ?? p.visited_at ?? ""),
        }
      })
    : []
}

export function formatActivityId(rawId?: string, seed?: string): string {
  if (rawId && /^ACT\s*-\s*\d+$/i.test(rawId)) {
    const num = rawId.replace(/^ACT\s*-\s*/i, "")
    return `ACT-${num}`
  }
  if (rawId && /^act-\d+$/i.test(rawId)) {
    const num = rawId.replace(/^act-/i, "")
    return `ACT-${num}`
  }
  if (rawId && rawId.startsWith("ACTIVITY#")) {
    const cleanNum = rawId.replace("ACTIVITY#", "").replace(/[^0-9]/g, "")
    if (cleanNum.length >= 4) {
      return `ACT-${cleanNum.slice(0, 5)}`
    }
  }
  let hash = 0
  const str = rawId || seed || String(Math.random())
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const positiveHash = (Math.abs(hash) % 90000) + 10000
  return `ACT-${positiveHash}`
}

export function formatEventId(rawId?: string): string {
  if (!rawId || rawId === "N/A") return "N/A"
  if (rawId.startsWith("SAAF-") || rawId.startsWith("saaf-")) {
    return rawId.toUpperCase()
  }
  const clean = rawId
    .replace(/^sub_/, "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase()
  if (clean.length >= 6) {
    return `SAAF-${clean.slice(0, 8)}`
  }
  return `SAAF-${rawId.toUpperCase()}`
}

export function resolveUserDisplayName(
  notification: ActivityNotification
): string {
  return notification.userName || notification.signatory || "Unknown actor"
}

export function resolveUserGroup(notification: ActivityNotification): string {
  return notification.userRole || "unknown"
}

export function cleanRemarkComment(rawComment?: string): string {
  if (!rawComment) return ""
  let text = String(rawComment)
  text = text
    .replace(
      /\(\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\s*\)/g,
      ""
    )
    .replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      ""
    )
    .replace(/\(\s*sub_[a-zA-Z0-9_]+\s*\)/g, "")
    .replace(/sub_[a-zA-Z0-9_]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()

  return text || "Action completed"
}

export function normalizeActivityItem(
  item: ReportRecord
): ActivityNotification {
  let notifType: NotificationType
  const actionUpper = String(
    item.actionType ?? item.notif_type ?? item.action ?? ""
  ).toUpperCase()
  // Non-submission CRUD (Organization / Signatory / Announcement)
  const isSubmissionAction = actionUpper.includes("SUBMISSION")
  if (actionUpper.includes("DENY") || actionUpper.includes("DENIED")) {
    notifType = "denied"
  } else if (
    actionUpper.includes("RETURN") ||
    actionUpper.includes("REVISION")
  ) {
    notifType = "returned"
  } else if (
    actionUpper.includes("APPROVE") ||
    actionUpper.includes("FULLY") ||
    actionUpper.includes("FINAL")
  ) {
    notifType = "approved"
  } else if (
    !isSubmissionAction &&
    (actionUpper === "DELETE" || actionUpper.endsWith("_DELETE"))
  ) {
    notifType = "deleted"
  } else if (
    !isSubmissionAction &&
    (actionUpper === "UPDATE" || actionUpper.endsWith("_UPDATE"))
  ) {
    notifType = "updated"
  } else if (
    !isSubmissionAction &&
    (actionUpper === "CREATE" || actionUpper.endsWith("_CREATE"))
  ) {
    notifType = "created"
  } else if (
    actionUpper.includes("CREATE") ||
    actionUpper.includes("SUBMIT") ||
    actionUpper.includes("STORE")
  ) {
    notifType = "submitted"
  } else {
    notifType = String(
      item.notif_type || item.actionType || "unknown"
    ) as NotificationType
  }

  // For non-submission CRUD actions there is no event/proposal ID.
  // Only look for a real submission_id when the action is submission-related.
  const rawSubId =
    item.submission_id ??
    item.submissionId ??
    (isSubmissionAction || item.module === "SUBMISSION" ? item.entityId : null)
  const rawActId = item.activity_id ?? item.activityId ?? item.PK ?? item.id
  const sentAt = item.sent_at ?? item.timestamp ?? ""

  const rawOrg =
    item.organizationName ??
    item.organization_name ??
    item.organization ??
    item.organization_id ??
    item.organizationId

  const organization_name =
    rawOrg && rawOrg !== "N/A" && rawOrg !== "null" && rawOrg !== "undefined"
      ? String(rawOrg)
      : undefined

  const rawComment =
    item.comment ??
    item.remarks ??
    item.description ??
    item.entityName ??
    `${item.userName || "User"} performed ${item.actionType || "action"}`

  // Resolve the formatted event ID, or "N/A" when there is no real submission.
  const resolvedSubmissionId = rawSubId ? String(rawSubId) : "N/A"

  return {
    activity_id: rawActId ? String(rawActId) : "Unknown activity",
    submission_id: resolvedSubmissionId,
    sent_at: String(sentAt),
    signatory: String(
      item.signatory ??
        item.userName ??
        item.user_name ??
        item.userRole ??
        item.userId ??
        "Unknown actor"
    ),
    notif_type: notifType,
    comment: String(rawComment),
    organization_name,
    userName: String(
      item.userName ?? item.user_name ?? item.userId ?? "Unknown actor"
    ),
    userEmail: String(item.userEmail ?? item.user_email ?? ""),
    userRole: String(item.userRole ?? item.user_role ?? "unknown"),
    entityName: String(item.entityName ?? item.entity_name ?? ""),
  }
}

export function useAnalyticsQuery(params: LogQueryParams) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["monitor-analytics", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockAnalyticsResponse(params)
      }
      try {
        const [statsRes, sessRes, actRes] = await Promise.all([
          apiClient.get<{ data: ReportRecord }>("/admins/monitor/stats"),
          apiClient.get<{ data: ReportRecord[] }>("/admins/monitor/sessions", {
            params: {
              startDate: params.startDate,
              endDate: params.endDate,
              limit: 200,
            },
          }),
          apiClient.get<{ data: ReportRecord[] }>("/admins/monitor/activity", {
            params: {
              startDate: params.startDate,
              endDate: params.endDate,
              limit: 200,
            },
          }),
        ])

        const stats = statsRes.data || {}
        const sessions = (sessRes.data || []).map(normalizeSessionItem)
        const activities = (actRes.data || []).map(normalizeActivityItem)

        const uniqueUsers = new Set(sessions.map((s) => s.userId)).size
        const approvedCount = activities.filter(
          (a) =>
            a.notif_type === "approved" || a.notif_type === "fully approved"
        ).length
        const returnedDeniedCount = activities.filter(
          (a) => a.notif_type === "returned" || a.notif_type === "denied"
        ).length

        return {
          logins: sessions.length || Number(stats.totalSessionsToday ?? 0),
          uniqueUsers: uniqueUsers || Number(stats.activeSessionsCount ?? 0),
          totalNotifications:
            activities.length || Number(stats.totalActivityToday ?? 0),
          approvedNotifications: approvedCount,
          returnedDeniedNotifications: returnedDeniedCount,
          loginsOverTime: [],
          notificationsByType: {
            approved: activities.filter((a) => a.notif_type === "approved")
              .length,
            fullyApproved: activities.filter(
              (a) => a.notif_type === "fully approved"
            ).length,
            returned: activities.filter((a) => a.notif_type === "returned")
              .length,
            denied: activities.filter((a) => a.notif_type === "denied").length,
          },
          alerts: [],
        }
      } catch (err) {
        console.error("useAnalyticsQuery failed", err)
        throw err
      }
    },
  })
}

const sessionRequestInFlight = new Map<
  string,
  Promise<{ data: ReportRecord[]; nextToken?: string | null }>
>()

async function fetchSessionsWithDeduplication(
  startDate?: string,
  endDate?: string,
  cursor?: string | null
) {
  const cacheKey = `${startDate ?? ""}_${endDate ?? ""}_${cursor ?? ""}`
  if (sessionRequestInFlight.has(cacheKey)) {
    return sessionRequestInFlight.get(cacheKey)!
  }

  const query: Record<string, string | number | boolean | undefined> = {
    startDate,
    endDate,
    limit: 200,
    nextToken: cursor ?? undefined,
  }

  const promise = apiClient
    .get<{ data: ReportRecord[]; nextToken?: string | null }>(
      "/admins/monitor/sessions",
      { params: query }
    )
    .finally(() => {
      sessionRequestInFlight.delete(cacheKey)
    })

  sessionRequestInFlight.set(cacheKey, promise)
  return promise
}

export function useSessionsQuery(params: LogQueryParams) {
  return useQuery<SessionsResponse>({
    queryKey: ["monitor-sessions", params.startDate, params.endDate],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockSessionsResponse(params)
      }
      try {
        const res = await fetchSessionsWithDeduplication(
          params.startDate,
          params.endDate,
          params.cursor
        )
        const rawItems = res.data || []
        const items = rawItems.map(normalizeSessionItem)
        return {
          data: items,
          cursor: res.nextToken || null,
        }
      } catch (err) {
        console.error("useSessionsQuery failed", err)
        throw err
      }
    },
  })
}

export function useActivitiesQuery(params: LogQueryParams) {
  return useQuery<ActivitiesResponse>({
    queryKey: ["monitor-activities", params.startDate, params.endDate],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockActivitiesResponse(params)
      }
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
          limit: 200,
          nextToken: params.cursor,
        }
        const res = await apiClient.get<{
          data: ReportRecord[]
          nextToken?: string | null
        }>("/admins/monitor/activity", { params: query })
        const rawItems = res.data || []
        const filteredItems = rawItems.filter((item: ReportRecord) => {
          const act = String(
            item.actionType ?? item.notif_type ?? item.action ?? ""
          ).toUpperCase()
          return (
            !act.includes("SUBMISSION_UPDATE") &&
            !act.includes("LOGIN") &&
            !act.includes("LOGOUT")
          )
        })
        const items = filteredItems.map(normalizeActivityItem)
        return {
          data: items,
          cursor: res.nextToken || null,
        }
      } catch (err) {
        console.error("useActivitiesQuery failed", err)
        throw err
      }
    },
  })
}

export async function fetchSessionDetail(
  sessionId: string,
  signal?: AbortSignal
): Promise<SessionDetailResponse> {
  if (IS_MOCK_MODE) {
    const mock = getMockSessionDetail(sessionId)
    if (!mock) throw new Error("Session not found.")
    return mock
  }
  const res = await apiClient.get<{ data: ReportRecord }>(
    `/admins/monitor/sessions/${encodeURIComponent(sessionId)}`,
    { signal, cache: "no-store" }
  )
  if (
    !res.data ||
    res.data.session_id !== sessionId ||
    !Array.isArray(res.data.pages_visited)
  )
    throw new Error("The complete session timeline could not be retrieved.")
  return { session: normalizeSessionItem(res.data), notifications: [] }
}
export function useSessionDetailQuery(sessionId: string | null) {
  const scope = useReportScope()
  return useQuery<SessionDetailResponse | null>({
    queryKey: ["monitor-session-detail", sessionId, scope],
    queryFn: ({ signal }) =>
      sessionId ? fetchSessionDetail(sessionId, signal) : null,
    enabled: Boolean(sessionId),
    gcTime: 0,
  })
}

export function useActivityDetailQuery(
  submissionId: string | null,
  sentAt: string | null
) {
  return useQuery<ActivityNotification | null>({
    queryKey: [
      "monitor-activity-detail",
      submissionId,
      sentAt,
      useReportScope(),
    ],
    queryFn: async () => {
      if (!submissionId || !sentAt) return null
      if (IS_MOCK_MODE) {
        return (
          getMockActivitiesResponse().data.find(
            (a) => a.submission_id === submissionId && a.sent_at === sentAt
          ) || null
        )
      }
      try {
        const res = await apiClient.get<{ data: ReportRecord }>(
          `/admins/monitor/activity/${submissionId}`
        )
        return res.data ? normalizeActivityItem(res.data) : null
      } catch (err) {
        console.error("useActivityDetailQuery failed", err)
        throw err
      }
    },
    enabled: Boolean(submissionId && sentAt),
  })
}

export function useActivityAnalyticsQuery(params: LogQueryParams) {
  return useQuery<ActivityAnalyticsResponse>({
    queryKey: ["monitor-analytics-activity", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockActivityAnalytics(params)
      }
      try {
        const res = await apiClient.get<{ data: ReportRecord[] }>(
          "/admins/monitor/activity",
          {
            params: {
              startDate: params.startDate,
              endDate: params.endDate,
              limit: 200,
            },
          }
        )
        const rawActivities = res.data || []
        const activities = rawActivities.map(normalizeActivityItem)

        const submissionsToday = activities.filter(
          (a) =>
            String(a.notif_type).toUpperCase() !== "LOGIN" &&
            String(a.notif_type).toUpperCase() !== "LOGOUT"
        ).length
        const adviserReviews = activities.filter((a) =>
          a.signatory.toLowerCase().includes("adviser")
        ).length
        const deanReviews = activities.filter((a) =>
          a.signatory.toLowerCase().includes("dean")
        ).length
        const osaarReviews = activities.filter((a) =>
          a.signatory.toLowerCase().includes("osaar")
        ).length
        const cdmReviews = activities.filter((a) =>
          a.signatory.toLowerCase().includes("cdm")
        ).length
        const inEditSubmissions = activities.filter(
          (a) => a.notif_type === "returned"
        ).length

        const alerts: AnalyticsAlert[] = []
        activities.forEach((a) => {
          if (a.sent_at) {
            const h = new Date(a.sent_at).getHours()
            if (h >= 23 || h < 5) {
              alerts.push({
                type: "AFTER_HOURS_REVIEW",
                userName: a.signatory,
                detail: `Signatory action performed at ${new Date(a.sent_at).toLocaleTimeString("en-US", { timeZone: "Asia/Manila" })} Manila time outside standard operating hours`,
                submissionId: a.submission_id,
              })
            }
          }
        })

        return {
          submissionsToday: submissionsToday || activities.length,
          adviserReviews,
          deanReviews,
          osaarReviews,
          cdmReviews,
          inEditSubmissions,
          alerts,
        }
      } catch (err) {
        console.error("useActivityAnalyticsQuery failed", err)
        throw err
      }
    },
  })
}

export function useSessionAnalyticsQuery(
  params: LogQueryParams & { compare?: "month" | "year" }
) {
  return useQuery<SessionAnalyticsResponse>({
    queryKey: ["monitor-analytics-sessions", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockSessionAnalytics(params)
      }
      try {
        const sessionsRes = await fetchSessionsWithDeduplication(
          params.startDate,
          params.endDate
        )

        const rawSessions = sessionsRes.data || []
        const sessions = rawSessions.map(normalizeSessionItem)

        // Role distribution
        const loginsByRole: LoginsByRoleMap = {
          student: 0,
          signatory: 0,
          admin: 0,
          signatoriesBreakdown: {
            adviser: 0,
            dean: 0,
            osaar: 0,
            cdm: 0,
          },
        }
        sessions.forEach((s) => {
          const roleCategory = classifySessionRole(
            s.userRole,
            s.userEmail,
            s.userName
          )
          if (roleCategory === "admin") {
            loginsByRole.admin++
          } else if (roleCategory === "signatory") {
            loginsByRole.signatory++
            const subtype = classifySignatorySubtype(
              s.userRole,
              s.userEmail,
              s.userName
            )
            if (loginsByRole.signatoriesBreakdown) {
              loginsByRole.signatoriesBreakdown[subtype]++
            }
          } else {
            loginsByRole.student++
          }
        })

        // Logged out sessions & duration
        const loggedOutSessions = sessions.filter(
          (s) =>
            s.status === "logged_out" ||
            s.status === "timed_out" ||
            s.status === "revoked"
        )
        const loggedOutSessionCount = loggedOutSessions.length

        let avgDuration = 0
        if (loggedOutSessionCount > 0) {
          const totalSecs = loggedOutSessions.reduce((acc, s) => {
            if (s.timeIn && s.timeOut) {
              const diff =
                (new Date(s.timeOut).getTime() - new Date(s.timeIn).getTime()) /
                1000
              return acc + (diff > 0 ? diff : 0)
            }
            return acc
          }, 0)
          avgDuration =
            Math.round((totalSecs / loggedOutSessionCount / 60) * 10) / 10
        }

        // Login volume by hour (24 hours)
        const hourCounts = new Array(24).fill(0)
        sessions.forEach((s) => {
          if (s.timeIn) {
            const h = new Date(s.timeIn).getHours()
            if (h >= 0 && h < 24) hourCounts[h]++
          }
        })

        const hoursLabels = [
          "00:00",
          "02:00",
          "04:00",
          "06:00",
          "08:00",
          "10:00",
          "12:00",
          "14:00",
          "16:00",
          "18:00",
          "20:00",
          "22:00",
        ]
        const todayVolume = hoursLabels.map(
          (_, i) => hourCounts[i * 2] + hourCounts[i * 2 + 1]
        )

        // Heatmap data (7 days x 24 hours)
        const heatmapGrid = Array.from({ length: 7 }, () =>
          new Array(24).fill(0)
        )
        sessions.forEach((s) => {
          if (s.timeIn) {
            const d = new Date(s.timeIn)
            const day = d.getDay() // 0..6
            const hour = d.getHours() // 0..23
            heatmapGrid[day][hour]++
          }
        })

        const heatmapData: HeatmapCell[] = []
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            heatmapData.push({
              dayOfWeek: day,
              hour,
              count: heatmapGrid[day][hour],
            })
          }
        }

        // Real security alerts
        const alerts: AnalyticsAlert[] = []
        const activeByUser = new Map<string, Session[]>()
        sessions.forEach((s) => {
          if (s.status === "active" || s.status === "no_logout_recorded") {
            const list = activeByUser.get(s.userId) || []
            list.push(s)
            activeByUser.set(s.userId, list)
          }
        })
        activeByUser.forEach((list) => {
          if (list.length > 1) {
            alerts.push({
              type: "CONCURRENT_SESSIONS",
              userName: list[0].userName,
              detail: `${list.length} active sessions detected simultaneously from IP(s): ${list.map((x) => x.ipAddress).join(", ")}`,
              sessionId: list[0].sessionId,
            })
          }
        })

        const nowMs = Date.now()
        sessions.forEach((s) => {
          if (s.status === "no_logout_recorded" && s.timeIn) {
            const durHours =
              (nowMs - new Date(s.timeIn).getTime()) / (1000 * 3600)
            if (durHours > 8) {
              alerts.push({
                type: "LONG_SESSION",
                userName: s.userName,
                detail: `Session has been continuously active for over ${durHours.toFixed(1)} hours (> 8h threshold)`,
                sessionId: s.sessionId,
              })
            }
          }
        })

        return {
          loginVolume: {
            hours: hoursLabels,
            today: todayVolume,
            monthAvg: [],
            yearAvg: [],
          },
          avgSessionDurationMinutes: avgDuration,
          loggedOutSessionCount,
          loginsByRole,
          heatmapData,
          alerts,
        }
      } catch (err) {
        console.error("useSessionAnalyticsQuery failed", err)
        throw err
      }
    },
  })
}
