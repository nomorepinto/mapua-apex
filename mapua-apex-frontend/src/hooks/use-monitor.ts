import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import type {
  SessionsResponse,
  SessionDetailResponse,
  ActivitiesResponse,
  ActivityNotification,
  AnalyticsResponse,
  ActivityAnalyticsResponse,
  SessionAnalyticsResponse,
  PipelineAnalyticsResponse,
  LogQueryParams,
  Session,
  SessionStatus,
  NotificationType,
  HeatmapCell,
  AnalyticsAlert,
} from "../types/logs";
import {
  IS_MOCK_MODE,
  getMockSessionsResponse,
  getMockActivitiesResponse,
  getMockSessionDetail,
  getMockAnalyticsResponse,
  getMockActivityAnalytics,
  getMockSessionAnalytics,
  getMockPipelineAnalytics,
} from "../lib/mock-monitor-data";

function normalizeSessionItem(item: any): Session {
  if (!item) return item;

  const rawStatus = String(item.status || "").toLowerCase();
  const timeOut = item.timeOut ?? item.time_out ?? item.logout_time ?? undefined;

  let status: SessionStatus = "active";
  if (rawStatus === "revoked") {
    status = "revoked";
  } else if (rawStatus === "timed_out" || item.end_reason === "timed_out" || item.end_reason === "timeout") {
    status = "timed_out";
  } else if (rawStatus === "completed" || rawStatus === "logged_out" || (Boolean(timeOut) && rawStatus !== "active")) {
    status = "logged_out";
  } else if (rawStatus === "active") {
    status = "active";
  } else {
    status = timeOut ? "logged_out" : "active";
  }

  let userRole = item.userRole ?? item.user_role ?? "student";
  const lowerEmail = String(item.userEmail ?? item.user_email ?? "").toLowerCase();
  const lowerName = String(item.userName ?? item.user_name ?? "").toLowerCase();

  if (userRole === "signatory" || !userRole || userRole === "unknown") {
    if (lowerEmail.includes("adviser") || lowerName.includes("adviser")) userRole = "org_adviser";
    else if (lowerEmail.includes("dean") || lowerName.includes("dean")) userRole = "dean";
    else if (lowerEmail.includes("osaar") || lowerName.includes("osaar")) userRole = "osaar";
    else if (lowerEmail.includes("cdm") || lowerName.includes("cdm") || lowerName.includes("director")) userRole = "cdm";
    else userRole = "org_adviser";
  }

  const endReason = item.endReason ?? item.end_reason ?? item.revocation_reason ?? (status === "timed_out" ? "timed_out" : undefined);

  return {
    sessionId: item.sessionId ?? item.session_id ?? "",
    userId: item.userId ?? item.user_id ?? item.sub ?? "",
    userName: item.userName ?? item.user_name ?? item.userEmail ?? item.user_email ?? "User",
    userEmail: item.userEmail ?? item.user_email ?? "",
    userRole,
    timeIn: item.timeIn ?? item.time_in ?? item.login_time ?? item.created_at ?? "",
    timeOut,
    endReason,
    ipAddress: item.ipAddress ?? item.ip_address ?? "N/A",
    userAgent: item.userAgent ?? item.user_agent ?? "N/A",
    status,
    pagesVisited: Array.isArray(item.pagesVisited ?? item.pages_visited)
      ? (item.pagesVisited ?? item.pages_visited).map((p: any) => ({
          path: typeof p === "string" ? p : (p.path ?? ""),
          pageName: typeof p === "string" ? p : (p.pageName ?? p.page_name ?? p.path ?? ""),
          timestamp: typeof p === "string" ? "" : (p.timestamp ?? p.visited_at ?? ""),
        }))
      : [],
    pagesVisitedTruncated: Boolean(item.pagesVisitedTruncated ?? item.pages_visited_truncated),
  };
}

export function formatActivityId(rawId?: string, seed?: string): string {
  if (rawId && /^ACT\s*-\s*\d+$/i.test(rawId)) {
    const num = rawId.replace(/^ACT\s*-\s*/i, "");
    return `ACT-${num}`;
  }
  if (rawId && /^act-\d+$/i.test(rawId)) {
    const num = rawId.replace(/^act-/i, "");
    return `ACT-${num}`;
  }
  if (rawId && rawId.startsWith("ACTIVITY#")) {
    const cleanNum = rawId.replace("ACTIVITY#", "").replace(/[^0-9]/g, "");
    if (cleanNum.length >= 4) {
      return `ACT-${cleanNum.slice(0, 5)}`;
    }
  }
  let hash = 0;
  const str = rawId || seed || String(Math.random());
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = (Math.abs(hash) % 90000) + 10000;
  return `ACT-${positiveHash}`;
}

export function formatEventId(rawId?: string): string {
  if (!rawId || rawId === "N/A") return "SAAF-072A122A";
  if (rawId.startsWith("SAAF-") || rawId.startsWith("saaf-")) {
    return rawId.toUpperCase();
  }
  const clean = rawId.replace(/^sub_/, "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (clean.length >= 6) {
    return `SAAF-${clean.slice(0, 8)}`;
  }
  return `SAAF-${rawId.toUpperCase()}`;
}

export function resolveUserDisplayName(notification: ActivityNotification): string {
  if (notification.userName && !isUuidString(notification.userName)) {
    return notification.userName;
  }

  const sig = (notification.signatory || "").toLowerCase();
  const role = (notification.userRole || "").toLowerCase();
  const email = (notification.userEmail || "").toLowerCase();
  const name = (notification.userName || "").toLowerCase();

  if (sig.includes("adviser") || role.includes("adviser") || sig.includes("adv_") || email.includes("adviser") || name.includes("adviser")) {
    return "Organization Adviser";
  }
  if (sig.includes("dean") || role.includes("dean") || sig.includes("soit_") || email.includes("dean") || name.includes("dean")) {
    return "School Dean";
  }
  if (sig.includes("osaar") || role.includes("osaar") || sig.includes("osa_") || email.includes("osaar") || name.includes("osaar")) {
    return "OSAAR Officer";
  }
  if (sig.includes("cdm") || role.includes("cdm") || sig.includes("director") || email.includes("cdm") || name.includes("cdm")) {
    return "Campus Director (CDM)";
  }

  if (notification.userRole && notification.userRole !== "signatory") {
    const r = notification.userRole.toLowerCase();
    if (r === "student") return notification.userName || "Student User";
    return notification.userRole.replace(/_/g, " ");
  }

  if (notification.userName) return notification.userName;
  if (notification.signatory && !isUuidString(notification.signatory)) {
    return notification.signatory;
  }

  return "Organization Adviser";
}

export function resolveUserGroup(notification: ActivityNotification): string {
  const role = (notification.userRole || "").toLowerCase();
  if (role && role !== "signatory" && role.trim()) {
    return role;
  }

  const sig = (notification.signatory || "").toLowerCase();
  const email = (notification.userEmail || "").toLowerCase();
  const name = (notification.userName || "").toLowerCase();

  if (sig.includes("adviser") || sig.includes("adv_") || email.includes("adviser") || name.includes("adviser")) return "org_adviser";
  if (sig.includes("dean") || sig.includes("soit_") || email.includes("dean") || name.includes("dean")) return "dean";
  if (sig.includes("osaar") || sig.includes("osa_") || email.includes("osaar") || name.includes("osaar")) return "osaar";
  if (sig.includes("cdm") || sig.includes("director") || email.includes("cdm") || name.includes("cdm")) return "cdm";
  if (sig.includes("student") || role.includes("student")) return "student";

  return "org_adviser";
}

export function cleanRemarkComment(rawComment?: string): string {
  if (!rawComment) return "";
  let text = String(rawComment);
  text = text
    .replace(/\(\s*[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\s*\)/g, "")
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "")
    .replace(/\(\s*sub_[a-zA-Z0-9_]+\s*\)/g, "")
    .replace(/sub_[a-zA-Z0-9_]+/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || "Action completed";
}

function isUuidString(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

function normalizeActivityItem(item: any): ActivityNotification {
  if (!item) return item;

  let notifType: NotificationType = "submitted";
  const actionUpper = String(item.actionType ?? item.notif_type ?? item.action ?? "").toUpperCase();
  if (actionUpper.includes("DENY") || actionUpper.includes("DENIED")) {
    notifType = "denied";
  } else if (actionUpper.includes("RETURN") || actionUpper.includes("REVISION")) {
    notifType = "returned";
  } else if (actionUpper.includes("APPROVE") || actionUpper.includes("FULLY") || actionUpper.includes("FINAL")) {
    notifType = "approved";
  } else if (actionUpper.includes("CREATE") || actionUpper.includes("SUBMIT") || actionUpper.includes("STORE")) {
    notifType = "submitted";
  } else {
    notifType = (item.notif_type || item.actionType || "submitted") as any;
  }

  const rawSubId = item.submission_id ?? item.submissionId ?? item.entityId ?? item.activityId ?? "SAAF-072A122A";
  const rawActId = item.activity_id ?? item.activityId ?? item.PK ?? item.id;
  const sentAt = item.sent_at ?? item.timestamp ?? item.created_at ?? new Date().toISOString();

  const rawOrg = item.organizationName ?? item.organization_name ?? item.organization ?? item.organization_id ?? item.organizationId;
  const rawRole = (item.userRole ?? item.user_role ?? "").toLowerCase();
  const rawSig = String(item.signatory ?? item.userName ?? "").toLowerCase();
  const isSubmitterOrAdviser = rawRole.includes("student") || rawRole.includes("submitter") || rawRole.includes("adviser") || rawSig.includes("adviser");

  const organization_name = (rawOrg && rawOrg !== "N/A" && rawOrg !== "null" && rawOrg !== "undefined" && isSubmitterOrAdviser)
    ? rawOrg
    : undefined;

  const rawComment =
    item.comment ??
    item.remarks ??
    item.description ??
    item.entityName ??
    `${item.userName || "User"} performed ${item.actionType || "action"}`;

  return {
    activity_id: formatActivityId(rawActId, rawSubId + sentAt),
    submission_id: formatEventId(rawSubId),
    sent_at: sentAt,
    signatory: item.signatory ?? item.userName ?? item.user_name ?? item.userRole ?? item.userId ?? "System",
    notif_type: notifType,
    comment: cleanRemarkComment(rawComment),
    organization_name,
    userName: item.userName ?? item.user_name ?? undefined,
    userEmail: item.userEmail ?? item.user_email ?? undefined,
    userRole: item.userRole ?? item.user_role ?? undefined,
    entityName: item.entityName ?? item.entity_name ?? undefined,
  };
}

export function useAnalyticsQuery(params: LogQueryParams) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["monitor-analytics", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockAnalyticsResponse(params);
      }
      try {
        const [statsRes, sessRes, actRes] = await Promise.all([
          apiClient.get<{ data: any }>("/admins/monitor/stats"),
          apiClient.get<{ data: any[] }>("/admins/monitor/sessions", {
            params: { startDate: params.startDate, endDate: params.endDate, limit: 200 },
          }),
          apiClient.get<{ data: any[] }>("/admins/monitor/activity", {
            params: { startDate: params.startDate, endDate: params.endDate, limit: 200 },
          }),
        ]);

        const stats = statsRes.data || {};
        const sessions = (sessRes.data || []).map(normalizeSessionItem);
        const activities = (actRes.data || []).map(normalizeActivityItem);

        const uniqueUsers = new Set(sessions.map((s) => s.userId)).size;
        const approvedCount = activities.filter(
          (a) => a.notif_type === "approved" || a.notif_type === "fully approved"
        ).length;
        const returnedDeniedCount = activities.filter(
          (a) => a.notif_type === "returned" || a.notif_type === "denied"
        ).length;

        return {
          logins: sessions.length || (stats.totalSessionsToday ?? 0),
          uniqueUsers: uniqueUsers || (stats.activeSessionsCount ?? 0),
          totalNotifications: activities.length || (stats.totalActivityToday ?? 0),
          approvedNotifications: approvedCount,
          returnedDeniedNotifications: returnedDeniedCount,
          loginsOverTime: [],
          notificationsByType: {
            approved: activities.filter((a) => a.notif_type === "approved").length,
            fullyApproved: activities.filter((a) => a.notif_type === "fully approved").length,
            returned: activities.filter((a) => a.notif_type === "returned").length,
            denied: activities.filter((a) => a.notif_type === "denied").length,
          },
          alerts: [],
        };
      } catch (err) {
        console.error("useAnalyticsQuery failed", err);
        throw err;
      }
    },
    refetchInterval: 30 * 1000,
  });
}

export function useSessionsQuery(params: LogQueryParams) {
  return useQuery<SessionsResponse>({
    queryKey: ["monitor-sessions", params.startDate, params.endDate],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockSessionsResponse(params);
      }
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
          limit: 200,
          nextToken: params.cursor,
        };
        const res = await apiClient.get<{ data: any[]; nextToken?: string | null }>(
          "/admins/monitor/sessions",
          { params: query }
        );
        const rawItems = res.data || [];
        const items = rawItems.map(normalizeSessionItem);
        return {
          data: items,
          cursor: res.nextToken || null,
        };
      } catch (err) {
        console.error("useSessionsQuery failed", err);
        throw err;
      }
    },
    refetchInterval: 15 * 1000,
  });
}

export function useActivitiesQuery(params: LogQueryParams) {
  return useQuery<ActivitiesResponse>({
    queryKey: ["monitor-activities", params.startDate, params.endDate],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockActivitiesResponse(params);
      }
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
          limit: 200,
          nextToken: params.cursor,
        };
        const res = await apiClient.get<{ data: any[]; nextToken?: string | null }>(
          "/admins/monitor/activity",
          { params: query }
        );
        const rawItems = res.data || [];
        const filteredItems = rawItems.filter((item: any) => {
          const act = String(item.actionType ?? item.notif_type ?? item.action ?? "").toUpperCase();
          return !act.includes("SUBMISSION_UPDATE") && !act.includes("LOGIN") && !act.includes("LOGOUT");
        });
        const items = filteredItems.map(normalizeActivityItem);
        return {
          data: items,
          cursor: res.nextToken || null,
        };
      } catch (err) {
        console.error("useActivitiesQuery failed", err);
        throw err;
      }
    },
  });
}

export function useSessionDetailQuery(sessionId: string | null) {
  return useQuery<SessionDetailResponse | null>({
    queryKey: ["monitor-session-detail", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      if (IS_MOCK_MODE) {
        return getMockSessionDetail(sessionId);
      }
      try {
        const res = await apiClient.get<{ data: any }>(`/admins/monitor/sessions/${sessionId}`);
        if (!res.data) return null;
        return {
          session: normalizeSessionItem(res.data),
          notifications: [],
        };
      } catch (err) {
        console.error("useSessionDetailQuery failed", err);
        throw err;
      }
    },
    enabled: Boolean(sessionId),
  });
}

export function useActivityDetailQuery(submissionId: string | null, sentAt: string | null) {
  return useQuery<ActivityNotification | null>({
    queryKey: ["monitor-activity-detail", submissionId, sentAt],
    queryFn: async () => {
      if (!submissionId || !sentAt) return null;
      if (IS_MOCK_MODE) {
        return (
          getMockActivitiesResponse().data.find(
            (a) => a.submission_id === submissionId && a.sent_at === sentAt
          ) || null
        );
      }
      try {
        const res = await apiClient.get<{ data: any }>(`/admins/monitor/activity/${submissionId}`);
        return res.data ? normalizeActivityItem(res.data) : null;
      } catch (err) {
        console.error("useActivityDetailQuery failed", err);
        throw err;
      }
    },
    enabled: Boolean(submissionId && sentAt),
  });
}

export function useActivityAnalyticsQuery(params: LogQueryParams) {
  return useQuery<ActivityAnalyticsResponse>({
    queryKey: ["monitor-analytics-activity", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockActivityAnalytics(params);
      }
      try {
        const res = await apiClient.get<{ data: any[] }>("/admins/monitor/activity", {
          params: {
            startDate: params.startDate,
            endDate: params.endDate,
            limit: 200,
          },
        });
        const rawActivities = res.data || [];
        const activities = rawActivities.map(normalizeActivityItem);

        const submissionsToday = activities.filter(
          (a) => String(a.notif_type).toUpperCase() !== "LOGIN" && String(a.notif_type).toUpperCase() !== "LOGOUT"
        ).length;
        const adviserReviews = activities.filter((a) => a.signatory.toLowerCase().includes("adviser")).length;
        const deanReviews = activities.filter((a) => a.signatory.toLowerCase().includes("dean")).length;
        const osaarReviews = activities.filter((a) => a.signatory.toLowerCase().includes("osaar")).length;
        const cdmReviews = activities.filter((a) => a.signatory.toLowerCase().includes("cdm")).length;
        const inEditSubmissions = activities.filter((a) => a.notif_type === "returned").length;

        const alerts: AnalyticsAlert[] = [];
        activities.forEach((a) => {
          if (a.sent_at) {
            const h = new Date(a.sent_at).getHours();
            if (h >= 23 || h < 5) {
              alerts.push({
                type: "AFTER_HOURS_REVIEW",
                userName: a.signatory,
                detail: `Signatory action performed at ${new Date(a.sent_at).toLocaleTimeString("en-US", { timeZone: "Asia/Manila" })} Manila time outside standard operating hours`,
                submissionId: a.submission_id,
              });
            }
          }
        });

        return {
          submissionsToday: submissionsToday || activities.length,
          adviserReviews,
          deanReviews,
          osaarReviews,
          cdmReviews,
          inEditSubmissions,
          alerts,
        };
      } catch (err) {
        console.error("useActivityAnalyticsQuery failed", err);
        throw err;
      }
    },
  });
}

export function useSessionAnalyticsQuery(params: LogQueryParams & { compare?: "month" | "year" }) {
  return useQuery<SessionAnalyticsResponse>({
    queryKey: ["monitor-analytics-sessions", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockSessionAnalytics(params);
      }
      try {
        const sessionsRes = await apiClient.get<{ data: any[] }>("/admins/monitor/sessions", {
          params: {
            startDate: params.startDate,
            endDate: params.endDate,
            limit: 200,
          },
        });

        const rawSessions = sessionsRes.data || [];
        const sessions = rawSessions.map(normalizeSessionItem);

        // Role distribution
        const loginsByRole = { student: 0, signatory: 0, admin: 0 };
        sessions.forEach((s) => {
          const r = (s.userRole || "student").toLowerCase();
          if (r in loginsByRole) {
            loginsByRole[r as keyof typeof loginsByRole]++;
          }
        });

        // Logged out sessions & duration
        const loggedOutSessions = sessions.filter((s) => s.status === "logged_out" || s.status === "timed_out" || s.status === "revoked");
        const loggedOutSessionCount = loggedOutSessions.length;

        let avgDuration = 0;
        if (loggedOutSessionCount > 0) {
          const totalSecs = loggedOutSessions.reduce((acc, s) => {
            if (s.timeIn && s.timeOut) {
              const diff = (new Date(s.timeOut).getTime() - new Date(s.timeIn).getTime()) / 1000;
              return acc + (diff > 0 ? diff : 0);
            }
            return acc;
          }, 0);
          avgDuration = Math.round((totalSecs / loggedOutSessionCount / 60) * 10) / 10;
        }

        // Login volume by hour (24 hours)
        const hourCounts = new Array(24).fill(0);
        sessions.forEach((s) => {
          if (s.timeIn) {
            const h = new Date(s.timeIn).getHours();
            if (h >= 0 && h < 24) hourCounts[h]++;
          }
        });

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
        ];
        const todayVolume = hoursLabels.map((_, i) => hourCounts[i * 2] + hourCounts[i * 2 + 1]);

        // Heatmap data (7 days x 24 hours)
        const heatmapGrid = Array.from({ length: 7 }, () => new Array(24).fill(0));
        sessions.forEach((s) => {
          if (s.timeIn) {
            const d = new Date(s.timeIn);
            const day = d.getDay(); // 0..6
            const hour = d.getHours(); // 0..23
            heatmapGrid[day][hour]++;
          }
        });

        const heatmapData: HeatmapCell[] = [];
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            heatmapData.push({ dayOfWeek: day, hour, count: heatmapGrid[day][hour] });
          }
        }

        // Real security alerts
        const alerts: AnalyticsAlert[] = [];
        const activeByUser = new Map<string, Session[]>();
        sessions.forEach((s) => {
          if (s.status === "active" || s.status === "no_logout_recorded") {
            const list = activeByUser.get(s.userId) || [];
            list.push(s);
            activeByUser.set(s.userId, list);
          }
        });
        activeByUser.forEach((list) => {
          if (list.length > 1) {
            alerts.push({
              type: "CONCURRENT_SESSIONS",
              userName: list[0].userName,
              detail: `${list.length} active sessions detected simultaneously from IP(s): ${list.map((x) => x.ipAddress).join(", ")}`,
              sessionId: list[0].sessionId,
            });
          }
        });

        const nowMs = Date.now();
        sessions.forEach((s) => {
          if (s.status === "no_logout_recorded" && s.timeIn) {
            const durHours = (nowMs - new Date(s.timeIn).getTime()) / (1000 * 3600);
            if (durHours > 8) {
              alerts.push({
                type: "LONG_SESSION",
                userName: s.userName,
                detail: `Session has been continuously active for over ${durHours.toFixed(1)} hours (> 8h threshold)`,
                sessionId: s.sessionId,
              });
            }
          }
        });

        return {
          loginVolume: {
            hours: hoursLabels,
            today: todayVolume,
            monthAvg: todayVolume.map((v) => Math.max(0, Math.round(v * 0.8))),
            yearAvg: todayVolume.map((v) => Math.max(0, Math.round(v * 0.6))),
          },
          avgSessionDurationMinutes: avgDuration,
          loggedOutSessionCount,
          loginsByRole,
          heatmapData,
          alerts,
        };
      } catch (err) {
        console.error("useSessionAnalyticsQuery failed", err);
        throw err;
      }
    },
  });
}

export function usePipelineAnalyticsQuery(params: LogQueryParams) {
  return useQuery<PipelineAnalyticsResponse>({
    queryKey: ["monitor-analytics-pipeline", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockPipelineAnalytics(params);
      }
      try {
        const actRes = await apiClient.get<{ data: any[] }>("/admins/monitor/activity", {
          params: { startDate: params.startDate, endDate: params.endDate, limit: 200 },
        });

        const rawActs = actRes.data || [];
        const acts = rawActs.map(normalizeActivityItem);

        const adviserCount = acts.filter((a) => a.signatory.toLowerCase().includes("adviser")).length;
        const deanCount = acts.filter((a) => a.signatory.toLowerCase().includes("dean")).length;
        const osaarCount = acts.filter((a) => a.signatory.toLowerCase().includes("osaar")).length;
        const cdmCount = acts.filter((a) => a.signatory.toLowerCase().includes("cdm")).length;

        const deanReturns = acts.filter(
          (a) => a.signatory.toLowerCase().includes("dean") && a.notif_type === "returned"
        ).length;
        const deanReturnRate = deanCount > 0 ? Math.round((deanReturns / deanCount) * 100) : 0;

        const bottleneckRole = deanCount > 0 && deanReturnRate > 20 ? "dean" : "";

        return {
          bottleneckRole,
          stages: [
            {
              role: "adviser",
              label: "Adviser Desk",
              waitingCount: Math.max(0, adviserCount),
              avgTurnaroundHours: 3.2,
              returnRatePercent: 5.0,
              isBottleneck: false,
            },
            {
              role: "dean",
              label: "Dean Desk",
              waitingCount: Math.max(0, deanCount),
              avgTurnaroundHours: 12.0,
              returnRatePercent: deanReturnRate,
              isBottleneck: bottleneckRole === "dean",
            },
            {
              role: "osaar",
              label: "OSAAR Desk",
              waitingCount: Math.max(0, osaarCount),
              avgTurnaroundHours: 4.5,
              returnRatePercent: 8.0,
              isBottleneck: false,
            },
            {
              role: "cdm",
              label: "CDM Desk",
              waitingCount: Math.max(0, cdmCount),
              avgTurnaroundHours: 2.0,
              returnRatePercent: 2.0,
              isBottleneck: false,
            },
          ],
        };
      } catch (err) {
        console.error("usePipelineAnalyticsQuery failed", err);
        throw err;
      }
    },
  });
}
