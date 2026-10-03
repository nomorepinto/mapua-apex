import { create } from "zustand"
import type {
  Organization,
  Signatory,
  Submission,
  OrgAccountView,
  OrgStatus,
  Announcement,
  InstitutionMetrics,
} from "@/lib/types"

// ─── Audit Log Entry ─────────────────────────────────────────────────────────

export type AuditAction =
  | "submission_created"
  | "submission_approved"
  | "submission_denied"
  | "account_updated"
  | "announcement_created"
  | "status_changed"

export interface AuditLogEntry {
  id: string
  timestamp: string
  action: AuditAction
  actor: string
  description: string
  orgId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractUuid(compositeKey: string): string {
  return compositeKey.split("#").slice(1).join("#")
}

function resolveAdviser(orgUuid: string, signatories: Signatory[]): string {
  const roleKey = `ROLE#ADVISER#ORG#${orgUuid}`
  const match = signatories.find((s) => s.GSI4PK === roleKey)
  return match?.name ?? "—"
}

function buildOrgViews(
  orgs: Organization[],
  signatories: Signatory[],
  reps: Record<string, string>,
  statuses: Record<string, OrgStatus>
): OrgAccountView[] {
  return orgs.map((org) => {
    const uuid = extractUuid(org.PK)
    return {
      id: uuid,
      name: org.name,
      adviser: resolveAdviser(uuid, signatories),
      representative: reps[uuid] ?? "—",
      status: statuses[uuid] ?? "Inactive",
    }
  })
}

function computeMetrics(
  orgStatuses: Record<string, OrgStatus>,
  orgCount: number,
  submissionCount: number
): InstitutionMetrics {
  const activeCount = Object.values(orgStatuses).filter(
    (s) => s === "Active"
  ).length
  const newRegs = Object.values(orgStatuses).filter(
    (s) => s === "Pending Registration"
  ).length

  return {
    activeOrganizations: activeCount,
    activeOrganizationsChange:
      newRegs > 0
        ? `+${newRegs} registrations this term`
        : "No new registrations this term",
    totalActiveSubmissions: submissionCount,
    totalActiveSubmissionsNote:
      submissionCount > 0
        ? "Currently queued across all stages"
        : "No submissions queued",
    approvalSlaRate: 0,
    approvalSlaTurnaround:
      orgCount > 0 || submissionCount > 0
        ? "Waiting for decision data"
        : "No decisions recorded yet",
  }
}

// ─── Store Shape ─────────────────────────────────────────────────────────────

type AdminOsaState = {
  // Raw entities (would come from API in production)
  organizations: Organization[]
  signatories: Signatory[]
  submissions: Submission[]
  representatives: Record<string, string>
  orgStatuses: Record<string, OrgStatus>

  // Derived view-models (computed from raw entities)
  orgViews: OrgAccountView[]
  metrics: InstitutionMetrics

  // Announcements
  announcements: Announcement[]
  createAnnouncement: (title: string) => void
  updateAnnouncement: (id: string, title: string) => void
  deleteAnnouncement: (id: string) => void

  // Audit logs
  auditLogs: AuditLogEntry[]
  getAuditLogsForOrg: (orgId: string) => AuditLogEntry[]
  getAllAuditLogs: () => AuditLogEntry[]
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAdminOsaStore = create<AdminOsaState>((set, get) => {
  const organizations: Organization[] = []
  const signatories: Signatory[] = []
  const submissions: Submission[] = []
  const representatives: Record<string, string> = {}
  const orgStatuses: Record<string, OrgStatus> = {}

  return {
    organizations,
    signatories,
    submissions,
    representatives,
    orgStatuses,
    orgViews: buildOrgViews(
      organizations,
      signatories,
      representatives,
      orgStatuses
    ),
    metrics: computeMetrics(orgStatuses, organizations.length, submissions.length),
    announcements: [],

    createAnnouncement: (title) => {
      const now = new Date()
      const newAnnouncement: Announcement = {
        id: `ann-${Date.now()}`,
        title,
        date: now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        time: now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      }
      set((state) => ({
        announcements: [...state.announcements, newAnnouncement],
      }))
    },

    updateAnnouncement: (id, title) => {
      set((state) => ({
        announcements: state.announcements.map((a) =>
          a.id === id ? { ...a, title } : a
        ),
      }))
    },

    deleteAnnouncement: (id) => {
      set((state) => ({
        announcements: state.announcements.filter((a) => a.id !== id),
      }))
    },

    auditLogs: [],

    getAuditLogsForOrg: (orgId) => {
      return get()
        .auditLogs.filter((log) => log.orgId === orgId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
    },

    getAllAuditLogs: () => {
      return get().auditLogs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    },
  }
})
