export type EndReason = "logout" | "timeout" | "tab_closed" | "expired";
export type SessionStatus = "logged_out" | "no_logout_recorded";

export interface PageVisit {
  path: string;
  pageName: string;
  timestamp: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timeIn: string;
  timeOut?: string;
  endReason?: EndReason;
  ipAddress: string;
  userAgent: string;
  status: SessionStatus;
  pagesVisited: PageVisit[];
  pagesVisitedTruncated?: boolean;
}

export type NotificationType = "submitted" | "approved" | "denied" | "returned" | "submission_create";

export interface ActivityNotification {
  activity_id?: string;
  submission_id: string;
  sent_at: string;
  signatory: string;
  notif_type: NotificationType;
  comment: string;
  organization_name?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  entityName?: string;
}

export interface LogQueryParams {
  startDate?: string;
  endDate?: string;
  user?: string;
  role?: string;
  status?: string;
  notifType?: string;
  submissionId?: string;
  signatoryId?: string;
  pageSize?: number;
  cursor?: string;
}

export interface SessionsResponse {
  data: Session[];
  cursor?: string | null;
}

export interface SessionDetailResponse {
  session: Session;
  notifications: ActivityNotification[];
}

export interface ActivitiesResponse {
  data: ActivityNotification[];
  cursor?: string | null;
}

export interface AnalyticsAlert {
  type:
    | "CONCURRENT_SESSIONS"
    | "NEW_IP_LOCATION"
    | "LONG_SESSION"
    | "REPEATED_RETURNS"
    | "AFTER_HOURS_REVIEW"
    | "BULK_STATUS_CHANGE";
  userName: string;
  detail: string;
  sessionId?: string;
  submissionId?: string;
}

export interface LoginsOverTimeBucket {
  bucket: string;
  count: number;
}

export interface NotificationsByTypeMap {
  approved: number;
  fullyApproved: number;
  returned: number;
  denied: number;
}

export interface AnalyticsResponse {
  logins: number;
  uniqueUsers: number;
  totalNotifications: number;
  approvedNotifications: number;
  returnedDeniedNotifications: number;
  loginsOverTime: LoginsOverTimeBucket[];
  notificationsByType: NotificationsByTypeMap;
  alerts: AnalyticsAlert[];
}

export interface ActivityAnalyticsResponse {
  submissionsToday: number;
  adviserReviews: number;
  deanReviews: number;
  osaarReviews: number;
  cdmReviews: number;
  inEditSubmissions: number;
  alerts?: AnalyticsAlert[];
}

export interface LoginVolumeTimeComparison {
  hours: string[];
  today: number[];
  monthAvg: number[];
  yearAvg: number[];
}

export interface LoginsByRoleMap {
  student: number;
  signatory: number;
  admin: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: number; // 0..23
  count: number;
}

export interface SessionAnalyticsResponse {
  loginVolume: LoginVolumeTimeComparison;
  avgSessionDurationMinutes: number;
  loggedOutSessionCount: number;
  loginsByRole: LoginsByRoleMap;
  heatmapData: HeatmapCell[];
  alerts?: AnalyticsAlert[];
}

export interface PipelineStage {
  role: "adviser" | "dean" | "osaar" | "cdm";
  label: string;
  waitingCount: number;
  avgTurnaroundHours: number;
  returnRatePercent: number;
  isBottleneck: boolean;
}

export interface PipelineAnalyticsResponse {
  bottleneckRole: string;
  stages: PipelineStage[];
}
