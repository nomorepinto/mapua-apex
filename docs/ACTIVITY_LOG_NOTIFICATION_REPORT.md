# Activity Log Notification Model Investigation Report

**Document Purpose**: Investigation into using DynamoDB `NOTIFICATION` objects as the backing data source for the System Monitor Activity Log.
**Audience**: Team Lead & Development Team  
**Date**: October 9, 2026  
**Status**: Completed (Read-Only Code Analysis)

---

## Executive Summary

This report evaluates the feasibility and data structure of using existing DynamoDB `NOTIFICATION` items to populate the Activity Log on the Monitor page. 

`NOTIFICATION` items in APEX are designed specifically as a **paper approval timeline** (recording when a signatory approves, returns, or denies a SAAF submission). They were not designed as a general-purpose system audit trail. As a result, while they provide full visibility into submission review decisions, they do not record system administration events (e.g. Org/Signatory CRUD), student form edits, user logins, IP addresses, or state diffs.

---

## 1. Notification Item Schema

### Backend DynamoDB Item Definition

In DynamoDB, each notification item has the following attributes:

| Attribute | Type | DynamoDB Format Example | API JSON Serialized Output | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PK` | String | `SUBMISSION#123e4567-e89b-12d3-a456-426614174000` | `submission_id`: `"123e4567-e89b-12d3-a456-426614174000"` | Partition Key: ID of the submission paper |
| `SK` | String | `NOTIFICATION#2026-10-09T14:30:00Z` | `sent_at`: `"2026-10-09T14:30:00Z"` | Sort Key: Timestamp of the notification |
| `signatory` | String | `SIGNATORY#adv001-uuid` | `signatory`: `"adv001-uuid"` | Signatory UUID associated with the action |
| `notif_type` | String | `"approved"` \| `"fully approved"` \| `"denied"` \| `"returned"` | `notif_type`: `"approved"` | Type of workflow notification |
| `comment` | String | `"Please revise budget breakdown item 2."` | `comment`: `"Please revise budget breakdown item 2."` | Reviewer comment (mandatory for returned/denied) |

### Frontend TypeScript Definition (`src/lib/types.ts`)

```typescript
export type NotificationType = "approved" | "fully approved" | "denied" | "returned"

export interface Notification {
  /** PK = `SUBMISSION#<uuid>` */
  PK: string
  /** SK = `NOTIFICATION#<timestamp>` */
  SK: string
  signatory: string
  notif_type: NotificationType
  /** Mandatory when notif_type is denied or returned */
  comment?: string
}
```

---

## 2. Key Pattern & Indexing Analysis (PK/SK & GSIs)

- **Partition Key (PK)**: `SUBMISSION#<submission_id>`
- **Sort Key (SK)**: `NOTIFICATION#<timestamp>`

### Index Availability & Query Capability
- **No Global Secondary Index (GSI) Exists for Notifications**: Notification items live strictly under their parent `SUBMISSION#<submission_id>` partition.
- **Query Scope**: You can query notifications for a single specific submission (`PK = SUBMISSION#id AND SK begins_with NOTIFICATION#`).
- **Global Cross-Submission Querying**: There is **no GSI** to query or list notifications across ALL submissions sorted by date. Fetching all notifications across the system requires either iterating over all submission partitions or scanning the base table for items where `SK` starts with `NOTIFICATION#`.

---

## 3. Action Coverage (What Creates Notifications vs. What Doesn't)

### Actions That CREATE Notifications
1. **Signatory Approval (`ApproveSubmission.php`)**: Generates a notification item with `notif_type` = `"approved"` or `"fully approved"`.
2. **Signatory Return (`ReturnSubmission.php`)**: Generates a notification item with `notif_type` = `"returned"` and a mandatory `comment`.
3. **Signatory Rejection (`DenySubmission.php`)**: Generates a notification item with `notif_type` = `"denied"` and a mandatory `comment`.
4. **Manual Timeline Entries**: Students/Signatories posting or updating timeline entries via the Notification API controller.

### Actions That DO NOT Create Notifications
1. **Student Form Creation & Edits**: Creating a SAAF submission or updating an existing draft/returned paper.
2. **Organization Management**: Adding, editing, or deleting an organization or changing council status.
3. **Signatory Management**: Adding, editing, reassigning, or deleting signatories.
4. **Announcements**: Creating, updating, or removing system announcements.
5. **Authentication & Session Events**: User logins, logouts, session heartbeats, or token refreshes.
6. **Venue & Equipment Requests**: Standalone venue approvals outside the main signatory chain.

---

## 4. Attributes Missing in Notifications (Compared to Full Activity Log Plan)

The original Activity Log design expected rich audit fields. The `NOTIFICATION` object **does not** contain the following fields:

| Missing Field | Description / Original Intended Use |
| :--- | :--- |
| `ip_address` | Client IP address for security & anomaly detection |
| `session_id` | Session ID tying activity to a specific browser session |
| `actor_id` / `user_id` | Cognito User Sub / Student ID (only signatory UUID is recorded) |
| `actor_name` / `user_name` | Human display name of the actor |
| `actor_email` | Email address of the user performing the action |
| `actor_role` | System role (e.g. Student, Adviser, Dean, OSAAR, Admin) |
| `module` / `entity` | Category tag (e.g. `ORGANIZATION`, `SIGNATORY`, `ANNOUNCEMENT`, `SESSION`) |
| `action` | Verb tag (e.g. `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`) |
| `before_state` / `after_state` | State diff payload (showing previous and updated values) |
| `user_agent` | Browser and device environment metadata |

---

## 5. Gap List: Original Activity Log Plan vs. Notification Support

| Feature | Original Activity Log Plan | Notification-Based Support | Gap Status |
| :--- | :--- | :--- | :--- |
| **Scope** | System-wide audit (All modules & actions) | SAAF Paper Approval Timeline only | ⚠️ **Major Gap**: Admin CRUD & Student edits unmonitored |
| **User Identification** | Any user (Students, Admins, Signatories) | Signatories only (`signatory` field) | ⚠️ **Partial Gap**: Student actions not captured |
| **Event Types** | Logins, Logouts, Creates, Edits, Deletes | Approved, Fully Approved, Returned, Denied | ⚠️ **Major Gap**: No security/auth/deletion logging |
| **Change Diffs** | Full before & after JSON comparison | Text comment string only | ⚠️ **Major Gap**: No property-level diff tracking |
| **Security Context** | IP address, Session ID, User Agent | None | ⚠️ **Major Gap**: No IP/session correlation |
| **Querying** | Date-range query across all activities | Requires scanning table or scanning per-submission | ⚠️ **Indexing Gap**: No date-based GSI |

---

## 6. Impact on Overview Page (Stats & Alerts Capabilities)

When building the Monitor Overview page strictly from available `NOTIFICATION` fields (and `SESSION` logs from Session Monitor):

### ✅ Metrics & Alerts That STILL WORK
1. **Total Approval Decisions**: Count of signatory approvals, returns, and denials within a timeframe.
2. **Approval Outcome Breakdown**: Ratio of Approved vs. Returned vs. Denied papers.
3. **Most Active Signatories**: Signatories generating the highest volume of approvals/reviews.
4. **Recent Paper Timeline Activity**: Feed of recent workflow approvals and reviewer feedback comments.
5. **Session Metrics (from Session Logs)**: Total active/ended sessions, peak concurrent users, session duration distribution.

### ❌ Metrics & Alerts That CANNOT WORK (Must Be Removed/Disabled)
1. **"Active Now" Counter** *(Requested to be removed across all pages)*.
2. **"Deletes & Destructive Actions"**: Notifications do not log deletion of orgs, signatories, or submissions.
3. **"Privileged Mutations"**: Org updates, signatory reassignments, and admin config edits leave no notification records.
4. **"After-Hours System Activity"**: Cannot distinguish general platform browsing or admin changes from paper reviews.
5. **"IP & Geographic Anomalies"**: IP addresses are not saved in notifications.
6. **"Failed Logins & Auth Security Alerts"**: Authentication attempts are handled by Cognito and not recorded in notifications.

---

## Summary Recommendation for Part 2

1. **Page Separation**: Split Monitor into separate routes:
   - `/monitor/overview` (Session stats + Notification workflow decision breakdown)
   - `/monitor/sessions` (User login sessions & heartbeats)
   - `/monitor/activities` (SAAF Submission Notification Timeline)
2. **Strict Attribute Alignment**: Ensure Activity Log UI displays *only* attributes contained in `NOTIFICATION` (`submission_id`, `sent_at`, `signatory`, `notif_type`, `comment`). Do not show fake IP, browser, before/after diffs, or student user roles.
3. **Detail Modal**: Implement a centered floating modal for details instead of a side drawer.
4. **Remove "Active Now"**: Remove "Active Now" indicators from header, overview, and log tables.
