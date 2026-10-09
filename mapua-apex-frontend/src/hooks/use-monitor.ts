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

export function useAnalyticsQuery(params: LogQueryParams) {
  return useQuery<AnalyticsResponse>({
    queryKey: ["monitor-analytics", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockAnalyticsResponse(params);
      }
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
        };
        return await apiClient.get<AnalyticsResponse>("/sessions-log/analytics", { params: query });
      } catch (err) {
        console.warn("useAnalyticsQuery failed, falling back to mock analytics", err);
        return getMockAnalyticsResponse(params);
      }
    },
    refetchInterval: 30 * 1000,
  });
}

export function useSessionsQuery(params: LogQueryParams) {
  return useQuery<SessionsResponse>({
    queryKey: ["monitor-sessions", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockSessionsResponse(params);
      }
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
          user: params.user,
          role: params.role,
          status: params.status,
          pageSize: params.pageSize ?? 25,
          cursor: params.cursor,
        };
        const res = await apiClient.get<SessionsResponse>("/sessions-log", { params: query });

        let accumulatedData = res.data || [];
        let currentCursor = res.cursor;

        while (accumulatedData.length < (params.pageSize ?? 25) && currentCursor) {
          query.cursor = currentCursor;
          const nextRes = await apiClient.get<SessionsResponse>("/sessions-log", { params: query });
          if (!nextRes.data || nextRes.data.length === 0) break;
          accumulatedData = [...accumulatedData, ...nextRes.data];
          currentCursor = nextRes.cursor;
        }

        return {
          data: accumulatedData,
          cursor: currentCursor,
        };
      } catch (err) {
        console.warn("useSessionsQuery failed, falling back to mock data", err);
        return getMockSessionsResponse(params);
      }
    },
    refetchInterval: 15 * 1000,
  });
}

export function useActivitiesQuery(params: LogQueryParams) {
  return useQuery<ActivitiesResponse>({
    queryKey: ["monitor-activities", params],
    queryFn: async () => {
      if (IS_MOCK_MODE) {
        return getMockActivitiesResponse(params);
      }
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
          notifType: params.notifType,
          submissionId: params.submissionId,
          signatoryId: params.signatoryId,
          pageSize: params.pageSize ?? 25,
          cursor: params.cursor,
        };
        const res = await apiClient.get<ActivitiesResponse>("/activities", { params: query });

        let accumulatedData = res.data || [];
        let currentCursor = res.cursor;

        while (accumulatedData.length < (params.pageSize ?? 25) && currentCursor) {
          query.cursor = currentCursor;
          const nextRes = await apiClient.get<ActivitiesResponse>("/activities", { params: query });
          if (!nextRes.data || nextRes.data.length === 0) break;
          accumulatedData = [...accumulatedData, ...nextRes.data];
          currentCursor = nextRes.cursor;
        }

        return {
          data: accumulatedData,
          cursor: currentCursor,
        };
      } catch (err) {
        console.warn("useActivitiesQuery failed, falling back to mock data", err);
        return getMockActivitiesResponse(params);
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
        return await apiClient.get<SessionDetailResponse>(`/sessions-log/${sessionId}`);
      } catch (err) {
        console.warn("useSessionDetailQuery failed, falling back to mock data", err);
        return getMockSessionDetail(sessionId);
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
        return await apiClient.get<ActivityNotification>(
          `/activities/${submissionId}/${sentAt}`
        );
      } catch (err) {
        console.warn("useActivityDetailQuery failed, falling back to mock data", err);
        return (
          getMockActivitiesResponse().data.find(
            (a) => a.submission_id === submissionId && a.sent_at === sentAt
          ) || null
        );
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
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
        };
        return await apiClient.get<ActivityAnalyticsResponse>("/activities/analytics", { params: query });
      } catch (err) {
        console.warn("useActivityAnalyticsQuery failed, falling back to mock analytics", err);
        return getMockActivityAnalytics(params);
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
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
          compare: params.compare,
        };
        return await apiClient.get<SessionAnalyticsResponse>("/sessions-log/analytics", { params: query });
      } catch (err) {
        console.warn("useSessionAnalyticsQuery failed, falling back to mock analytics", err);
        return getMockSessionAnalytics(params);
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
        const query: Record<string, string | number | boolean | undefined> = {
          startDate: params.startDate,
          endDate: params.endDate,
        };
        return await apiClient.get<PipelineAnalyticsResponse>("/activities/pipeline", { params: query });
      } catch (err) {
        console.warn("usePipelineAnalyticsQuery failed, falling back to mock analytics", err);
        return getMockPipelineAnalytics(params);
      }
    },
  });
}
