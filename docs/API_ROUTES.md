# APEX Monitor Analytics & Log API Contracts

This document defines the REST API endpoints, access guards, and JSON contracts for System Monitor session logs and Activity Log pipeline metrics.

---

## 0. Backend Route Group Definitions

Do NOT reuse `ROUTE_GROUPS['admin'] = ['admin', 'osaar']` for session endpoints (otherwise OSAAR could access session logs). Define the following dedicated backend route groups:

```php
ROUTE_GROUPS = [
    'session_viewer'  => ['admin'],
    'activity_viewer' => ['osaar', 'cdm_reviewer', 'cdm'],
];
```

---

## 1. Session Analytics & Logs (`session_viewer` Guarded)

### 1.1 Session Analytics
**Endpoint**: `GET /v1/sessions-log/analytics`  
**Authorization Guard**: `session_viewer` (`['admin']`)  
**Query Parameters**: `startDate` (ISO YYYY-MM-DD), `endDate` (ISO YYYY-MM-DD), `compare` (`"month"` | `"year"`)

#### Response Payload (`200 OK`)
```json
{
  "loginVolume": {
    "hours": ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
    "today": [0, 0, 1, 3, 12, 28, 35, 24, 18, 14, 8, 2],
    "monthAvg": [1, 0, 0, 2, 10, 22, 30, 20, 15, 12, 6, 3],
    "yearAvg": [1, 1, 0, 2, 8, 18, 25, 18, 12, 10, 5, 2]
  },
  "avgSessionDurationMinutes": 44.5,
  "loggedOutSessionCount": 38,
  "loginsByRole": {
    "student": 110,
    "signatory": 24,
    "admin": 8
  },
  "heatmapData": [
    { "dayOfWeek": 1, "hour": 8, "count": 12 },
    { "dayOfWeek": 1, "hour": 9, "count": 25 }
  ],
  "alerts": [
    {
      "type": "CONCURRENT_SESSIONS",
      "userName": "Maria Santos",
      "detail": "2 active session entries detected simultaneously from different IPs",
      "sessionId": "sess_89a7f10b2c3d4e5f"
    }
  ]
}
```

### 1.2 Session Logs Query
**Endpoint**: `GET /v1/sessions-log`  
**Authorization Guard**: `session_viewer` (`['admin']`)  
**Query Parameters**: `startDate`, `endDate`, `user`, `role`, `status` (`"logged_out"` | `"no_logout_recorded"`), `pageSize`, `cursor`

---

## 2. Activity Log & Approval Pipeline (`activity_viewer` Guarded)

### 2.1 Activity Analytics
**Endpoint**: `GET /v1/activities/analytics`  
**Authorization Guard**: `activity_viewer` (`['osaar', 'cdm_reviewer', 'cdm']`)  
**Query Parameters**: `startDate` (ISO YYYY-MM-DD), `endDate` (ISO YYYY-MM-DD)

#### Response Payload (`200 OK`)
```json
{
  "submissionsToday": 14,
  "adviserReviews": 28,
  "deanReviews": 18,
  "osaarReviews": 22,
  "cdmReviews": 12,
  "inEditSubmissions": 5,
  "alerts": [
    {
      "type": "AFTER_HOURS_REVIEW",
      "userName": "Adviser Desk",
      "detail": "Signatory action performed at 02:45 AM Manila time",
      "submissionId": "sub_2026_088"
    }
  ]
}
```

### 2.2 Approval Pipeline Analytics
**Endpoint**: `GET /v1/activities/pipeline`  
**Authorization Guard**: `activity_viewer` (`['osaar', 'cdm_reviewer', 'cdm']`)  
**Query Parameters**: `startDate`, `endDate`

#### Response Payload (`200 OK`)
```json
{
  "bottleneckRole": "dean",
  "stages": [
    {
      "role": "adviser",
      "label": "Adviser Desk",
      "waitingCount": 4,
      "avgTurnaroundHours": 3.2,
      "returnRatePercent": 8.5,
      "isBottleneck": false
    },
    {
      "role": "dean",
      "label": "Dean Desk",
      "waitingCount": 12,
      "avgTurnaroundHours": 18.4,
      "returnRatePercent": 24.0,
      "isBottleneck": true
    },
    {
      "role": "osaar",
      "label": "OSAAR Desk",
      "waitingCount": 3,
      "avgTurnaroundHours": 5.1,
      "returnRatePercent": 11.2,
      "isBottleneck": false
    },
    {
      "role": "cdm",
      "label": "CDM Desk",
      "waitingCount": 1,
      "avgTurnaroundHours": 2.8,
      "returnRatePercent": 4.0,
      "isBottleneck": false
    }
  ]
}
```

### 2.3 Activity Notifications Log
**Endpoint**: `GET /v1/activities`  
**Authorization Guard**: `activity_viewer` (`['osaar', 'cdm_reviewer', 'cdm']`)  
**Query Parameters**: `startDate`, `endDate`, `notifType`, `submissionId`, `signatoryId`, `pageSize`, `cursor`
