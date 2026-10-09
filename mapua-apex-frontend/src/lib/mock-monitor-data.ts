import type {
  Session,
  ActivityNotification,
  SessionsResponse,
  SessionDetailResponse,
  ActivitiesResponse,
  AnalyticsResponse,
  ActivityAnalyticsResponse,
  SessionAnalyticsResponse,
  PipelineAnalyticsResponse,
  HeatmapCell,
  LogQueryParams,
} from "../types/logs";

export const IS_MOCK_MODE = import.meta.env.VITE_MOCK_MONITOR === "true" || true;

const nowMs = Date.now();
const tenMinsAgo = new Date(nowMs - 10 * 60 * 1000).toISOString();
const fifteenMinsAgo = new Date(nowMs - 15 * 60 * 1000).toISOString();
const oneHourAgo = new Date(nowMs - 60 * 60 * 1000).toISOString();
const twoHoursAgo = new Date(nowMs - 120 * 60 * 1000).toISOString();
const threeHoursAgo = new Date(nowMs - 180 * 60 * 1000).toISOString();
const nineHoursAgo = new Date(nowMs - (9 * 60 + 15) * 60 * 1000).toISOString();

export const MOCK_SESSIONS: Session[] = [
  {
    sessionId: "sess_89a7f10b2c3d4e5f",
    userId: "usr_student_001",
    userName: "Maria Santos",
    userEmail: "maria.santos@mapua.edu.ph",
    userRole: "student",
    timeIn: tenMinsAgo,
    status: "no_logout_recorded",
    ipAddress: "136.158.42.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0",
    pagesVisited: [
      { path: "/student/dashboard", pageName: "Student Dashboard", timestamp: tenMinsAgo },
      { path: "/student/submissions", pageName: "My Submissions", timestamp: new Date(nowMs - 8 * 60 * 1000).toISOString() },
      { path: "/student/submissions/new", pageName: "New Event Proposal", timestamp: new Date(nowMs - 5 * 60 * 1000).toISOString() },
    ],
  },
  {
    sessionId: "sess_89a7f10b2c3d4e5f_conc",
    userId: "usr_student_001",
    userName: "Maria Santos",
    userEmail: "maria.santos@mapua.edu.ph",
    userRole: "student",
    timeIn: new Date(nowMs - 4 * 60 * 1000).toISOString(),
    status: "no_logout_recorded",
    ipAddress: "120.28.194.55",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X)",
    pagesVisited: [
      { path: "/student/submissions", pageName: "My Submissions", timestamp: new Date(nowMs - 4 * 60 * 1000).toISOString() },
    ],
  },
  {
    sessionId: "sess_11b22c33d44e55f6",
    userId: "usr_admin_002",
    userName: "Prof. Alejandro Ramos",
    userEmail: "alejandro.ramos@mapua.edu.ph",
    userRole: "admin",
    timeIn: twoHoursAgo,
    timeOut: oneHourAgo,
    endReason: "logout",
    status: "logged_out",
    ipAddress: "180.191.10.99",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
    pagesVisited: [
      { path: "/admin/dashboard", pageName: "Admin Dashboard", timestamp: twoHoursAgo },
      { path: "/admin/announcements", pageName: "Manage Announcements", timestamp: new Date(nowMs - 90 * 60 * 1000).toISOString() },
    ],
  },
  {
    sessionId: "sess_77c88d99e00f11a2",
    userId: "usr_student_044",
    userName: "Juan Dela Cruz",
    userEmail: "juan.delacruz@mapua.edu.ph",
    userRole: "student",
    timeIn: nineHoursAgo,
    status: "no_logout_recorded",
    ipAddress: "49.145.12.99",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0",
    pagesVisited: [
      { path: "/student/dashboard", pageName: "Student Dashboard", timestamp: nineHoursAgo },
    ],
  },
  {
    sessionId: "sess_99f88e77d66c55b4",
    userId: "usr_admin_001",
    userName: "System Admin Desk",
    userEmail: "admin@mapua.edu.ph",
    userRole: "admin",
    timeIn: threeHoursAgo,
    timeOut: twoHoursAgo,
    endReason: "timeout",
    status: "logged_out",
    ipAddress: "112.198.118.2",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/122.0.0.0",
    pagesVisited: [
      { path: "/admin/sessions", pageName: "Session Log", timestamp: threeHoursAgo },
    ],
  },
];

// MOCK NOTIFICATIONS (Matching the exact DynamoDB NOTIFICATION item shape)
export const MOCK_NOTIFICATIONS: ActivityNotification[] = [
  {
    submission_id: "sub_2026_099",
    sent_at: tenMinsAgo,
    signatory: "adv_001_uuid",
    notif_type: "approved",
    comment: "Adviser review completed. Approved for Dean endorsement.",
  },
  {
    submission_id: "sub_2026_095",
    sent_at: twoHoursAgo,
    signatory: "dean_soit_002_uuid",
    notif_type: "returned",
    comment: "Returned for revision: Please update venue reservation hours to end before 9:00 PM.",
  },
  {
    submission_id: "sub_2026_092",
    sent_at: nineHoursAgo,
    signatory: "cdm_001_uuid",
    notif_type: "denied",
    comment: "Denied: Proposed budget exceeds campus allocation limit for co-curricular events.",
  },
  {
    submission_id: "sub_2026_088",
    sent_at: threeHoursAgo,
    signatory: "osaar_001_uuid",
    notif_type: "fully approved",
    comment: "Final clearance granted. SAAF fully approved by OSAAR desk.",
  },
  {
    submission_id: "sub_2026_095",
    sent_at: fifteenMinsAgo,
    signatory: "osaar_001_uuid",
    notif_type: "returned",
    comment: "Returned for clarification on Institutional Alignment SDG explanation.",
  },
];

export function getMockSessionsResponse(params?: LogQueryParams): SessionsResponse {
  let filtered = [...MOCK_SESSIONS];

  if (params?.startDate && params?.endDate) {
    const startTs = new Date(params.startDate + "T00:00:00+08:00").getTime();
    const endTs = new Date(params.endDate + "T23:59:59+08:00").getTime();

    filtered = filtered.filter((s) => {
      const timeInTs = new Date(s.timeIn).getTime();
      return timeInTs >= startTs && timeInTs <= endTs;
    });
  }

  if (params?.role) {
    filtered = filtered.filter((s) => s.userRole === params.role);
  }
  if (params?.status) {
    filtered = filtered.filter((s) => s.status === params.status);
  }
  if (params?.user) {
    const q = params.user.toLowerCase();
    filtered = filtered.filter(
      (s) => s.userName.toLowerCase().includes(q) || s.userEmail.toLowerCase().includes(q)
    );
  }

  return {
    data: filtered,
    cursor: null,
  };
}

export function getMockActivitiesResponse(params?: LogQueryParams): ActivitiesResponse {
  let filtered = [...MOCK_NOTIFICATIONS];

  if (params?.startDate && params?.endDate) {
    const startTs = new Date(params.startDate + "T00:00:00+08:00").getTime();
    const endTs = new Date(params.endDate + "T23:59:59+08:00").getTime();

    filtered = filtered.filter((n) => {
      const ts = new Date(n.sent_at).getTime();
      return ts >= startTs && ts <= endTs;
    });
  }

  if (params?.notifType) {
    filtered = filtered.filter((n) => n.notif_type === params.notifType);
  }
  if (params?.submissionId) {
    const q = params.submissionId.toLowerCase();
    filtered = filtered.filter((n) => n.submission_id.toLowerCase().includes(q));
  }
  if (params?.signatoryId) {
    const q = params.signatoryId.toLowerCase();
    filtered = filtered.filter((n) => n.signatory.toLowerCase().includes(q));
  }

  return {
    data: filtered,
    cursor: null,
  };
}

export function getMockSessionDetail(id: string): SessionDetailResponse | null {
  const session = MOCK_SESSIONS.find((s) => s.sessionId === id) || MOCK_SESSIONS[0];
  const notifications = MOCK_NOTIFICATIONS.slice(0, 2);
  return { session, notifications };
}

export function getMockAnalyticsResponse(params?: LogQueryParams): AnalyticsResponse {
  const sessions = getMockSessionsResponse(params).data;
  const notifications = getMockActivitiesResponse(params).data;

  const logins = sessions.length;
  const uniqueUsers = new Set(sessions.map((s) => s.userId)).size;

  const totalNotifications = notifications.length;
  const approvedNotifications = notifications.filter(
    (n) => n.notif_type === "approved" || n.notif_type === "fully approved"
  ).length;
  const returnedDeniedNotifications = notifications.filter(
    (n) => n.notif_type === "returned" || n.notif_type === "denied"
  ).length;

  return {
    logins,
    uniqueUsers,
    totalNotifications,
    approvedNotifications,
    returnedDeniedNotifications,
    loginsOverTime: [
      { bucket: "08:00", count: 2 },
      { bucket: "10:00", count: 6 },
      { bucket: "12:00", count: 11 },
      { bucket: "14:00", count: 8 },
      { bucket: "16:00", count: 5 },
      { bucket: "18:00", count: 4 },
      { bucket: "22:00", count: 2 },
    ],
    notificationsByType: {
      approved: notifications.filter((n) => n.notif_type === "approved").length,
      fullyApproved: notifications.filter((n) => n.notif_type === "fully approved").length,
      returned: notifications.filter((n) => n.notif_type === "returned").length,
      denied: notifications.filter((n) => n.notif_type === "denied").length,
    },
    alerts: [
      {
        type: "CONCURRENT_SESSIONS",
        userName: "Maria Santos",
        detail: "2 active sessions detected simultaneously from different IPs (136.158.42.10 and 120.28.194.55)",
        sessionId: "sess_89a7f10b2c3d4e5f",
      },
      {
        type: "NEW_IP_LOCATION",
        userName: "Prof. Alejandro Ramos",
        detail: "Login detected from unrecognized IP address (180.191.10.99)",
        sessionId: "sess_11b22c33d44e55f6",
      },
      {
        type: "LONG_SESSION",
        userName: "Juan Dela Cruz",
        detail: "Session has been continuously active for over 9.5 hours (> 8h threshold)",
        sessionId: "sess_77c88d99e00f11a2",
      },
      {
        type: "REPEATED_RETURNS",
        userName: "Dean Office",
        detail: "Submission sub_2026_095 returned multiple times for revision",
        submissionId: "sub_2026_095",
      },
    ],
  };
}

export function getMockActivityAnalytics(params?: LogQueryParams): ActivityAnalyticsResponse {
  let notifications = [...MOCK_NOTIFICATIONS];

  if (params?.startDate && params?.endDate) {
    const startTs = new Date(params.startDate + "T00:00:00+08:00").getTime();
    const endTs = new Date(params.endDate + "T23:59:59+08:00").getTime();
    notifications = notifications.filter((n) => {
      const ts = new Date(n.sent_at).getTime();
      return ts >= startTs && ts <= endTs;
    });
  }

  const baseCount = Math.max(notifications.length, 1);

  return {
    submissionsToday: baseCount * 3 + 2,
    adviserReviews: baseCount * 5 + 3,
    deanReviews: baseCount * 3 + 3,
    osaarReviews: baseCount * 4 + 2,
    cdmReviews: baseCount * 2 + 2,
    inEditSubmissions: notifications.filter((n) => n.notif_type === "returned").length + 3,
    alerts: [
      {
        type: "AFTER_HOURS_REVIEW",
        userName: "Adviser Desk",
        detail: "Signatory action performed at 02:45 AM Manila time outside standard operating hours",
        submissionId: "sub_2026_088",
      },
      {
        type: "REPEATED_RETURNS",
        userName: "Dean Office",
        detail: "Submission sub_2026_095 returned 4 times for revision within 48 hours",
        submissionId: "sub_2026_095",
      },
    ],
  };
}

export function getMockSessionAnalytics(params?: LogQueryParams): SessionAnalyticsResponse {
  let sessions = [...MOCK_SESSIONS];

  if (params?.startDate && params?.endDate) {
    const startTs = new Date(params.startDate + "T00:00:00+08:00").getTime();
    const endTs = new Date(params.endDate + "T23:59:59+08:00").getTime();
    sessions = sessions.filter((s) => {
      const ts = new Date(s.timeIn).getTime();
      return ts >= startTs && ts <= endTs;
    });
  }

  const multiplier = Math.max(sessions.length, 1);

  const heatmapData: HeatmapCell[] = [];
  const baseCounts = [
    [0, 0, 0, 1, 4, 12, 22, 28, 20, 15, 8, 3, 1, 0, 0, 0, 2, 8, 14, 18, 12, 6, 2, 1], // Sun
    [0, 0, 0, 2, 8, 25, 45, 52, 40, 32, 18, 8, 3, 1, 0, 1, 6, 18, 35, 42, 28, 14, 5, 2], // Mon
    [0, 0, 0, 2, 9, 28, 48, 55, 42, 35, 20, 9, 3, 1, 0, 1, 7, 20, 38, 45, 30, 15, 6, 2], // Tue
    [0, 0, 0, 2, 8, 26, 46, 50, 38, 30, 16, 8, 3, 1, 0, 1, 6, 17, 34, 40, 26, 12, 4, 2], // Wed
    [0, 0, 0, 2, 9, 27, 47, 54, 41, 33, 19, 9, 3, 1, 0, 1, 7, 19, 36, 43, 29, 14, 5, 2], // Thu
    [0, 0, 0, 3, 10, 30, 50, 58, 45, 38, 22, 10, 4, 2, 1, 2, 8, 22, 40, 48, 32, 16, 7, 3], // Fri
    [0, 0, 0, 1, 5, 14, 24, 30, 22, 16, 9, 4, 2, 0, 0, 0, 3, 9, 15, 20, 14, 7, 3, 1], // Sat
  ];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push({
        dayOfWeek: day,
        hour,
        count: baseCounts[day][hour] || 0,
      });
    }
  }

  return {
    loginVolume: {
      hours: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
      today: [0, 0, 1, 3, 12, 28, 35, 24, 18, 14, 8, 2],
      monthAvg: [1, 0, 0, 2, 10, 22, 30, 20, 15, 12, 6, 3],
      yearAvg: [1, 1, 0, 2, 8, 18, 25, 18, 12, 10, 5, 2],
    },
    avgSessionDurationMinutes: 44.5,
    loggedOutSessionCount: multiplier * 7 + 3,
    loginsByRole: {
      student: multiplier * 20 + 10,
      signatory: multiplier * 5 + 4,
      admin: multiplier * 2 + 2,
    },
    heatmapData,
    alerts: [
      {
        type: "CONCURRENT_SESSIONS",
        userName: "Maria Santos",
        detail: "2 active sessions detected simultaneously from different IPs (136.158.42.10 and 120.28.194.55)",
        sessionId: "sess_89a7f10b2c3d4e5f",
      },
      {
        type: "NEW_IP_LOCATION",
        userName: "Prof. Alejandro Ramos",
        detail: "Login detected from unrecognized IP address (180.191.10.99)",
        sessionId: "sess_11b22c33d44e55f6",
      },
      {
        type: "LONG_SESSION",
        userName: "Juan Dela Cruz",
        detail: "Session has been continuously active for over 9.5 hours (> 8h threshold)",
        sessionId: "sess_77c88d99e00f11a2",
      },
    ],
  };
}

export function getMockPipelineAnalytics(params?: LogQueryParams): PipelineAnalyticsResponse {
  const isFiltered = Boolean(params?.startDate && params?.endDate);
  const factor = isFiltered ? 1 : 1.2;

  return {
    bottleneckRole: "dean",
    stages: [
      {
        role: "adviser",
        label: "Adviser Desk",
        waitingCount: Math.round(4 * factor),
        avgTurnaroundHours: 3.2,
        returnRatePercent: 8.5,
        isBottleneck: false,
      },
      {
        role: "dean",
        label: "Dean Desk",
        waitingCount: Math.round(12 * factor),
        avgTurnaroundHours: 18.4,
        returnRatePercent: 24.0,
        isBottleneck: true,
      },
      {
        role: "osaar",
        label: "OSAAR Desk",
        waitingCount: Math.round(3 * factor),
        avgTurnaroundHours: 5.1,
        returnRatePercent: 11.2,
        isBottleneck: false,
      },
      {
        role: "cdm",
        label: "CDM Desk",
        waitingCount: Math.round(1 * factor),
        avgTurnaroundHours: 2.8,
        returnRatePercent: 4.0,
        isBottleneck: false,
      },
    ],
  };
}
