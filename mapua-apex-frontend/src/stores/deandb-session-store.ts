import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import {
    fetchMyQueue,
    approveActivity as approveActivityRequest,
    denyActivity as denyActivityRequest,
} from "@/lib/signatories"

/**
 * Shape mirrors what the API returns (which itself mirrors the DynamoDB
 * single-table item). The frontend never talks to DynamoDB directly, and
 * never constructs PK/SK/GSI values itself — those come from the backend.
 */
export interface DynamoDBMetadata {
    PK?: string
    SK?: string
    GSI1PK?: string
    GSI1SK?: string
    createdAt?: string
    updatedAt?: string
    version?: number
}

export type ActivityClassification = "Co-curricular" | "Extra-curricular" | "Institutional"

export type ActivityStatus =
    | "Approved"
    | "Under Review"
    | "Pending Dean Approval"
    | "Needs Revision"
    | "Rejected"

export interface ActivityProposal extends DynamoDBMetadata {
    id: string
    title: string
    org: string
    date: string
    type: ActivityClassification | string
    status: ActivityStatus
    statusColor: string
    venue?: string
    description?: string
    targetParticipants?: number | string
    budget?: number | string
    submittedBy?: string
    proponentEmail?: string
    contactNumber?: string
    deanRemarks?: string
    reviewedAt?: string
    reviewedBy?: string
}

export interface DashboardStats {
    pendingProposals: string
    approvedActivities: string
    needsRevision: string
    totalSubmissions: string
    pendingChange?: string
    approvedChange?: string
    revisionChange?: string
    submissionsTerm?: string
}

export interface DeanSession {
    name: string | null
    title: string | null
    office: string | null
    email: string | null
    isAuthenticated: boolean
}

export interface DeanDashboardSessionState {
    // Session details — populated from Cognito after real sign-in, not hardcoded
    session: DeanSession

    // Data fetched from the API (backed by DynamoDB on the server side)
    activities: ActivityProposal[]
    stats: DashboardStats
    isLoadingActivities: boolean
    activitiesError: string | null

    // View / Filter State — safe to persist locally, doesn't touch server data
    selectedActivityId: string | null
    filterStatus: ActivityStatus | "All" | null
    searchQuery: string

    // Session actions — call these with whatever Amplify/Cognito resolves,
    // do not call signIn() with a made-up name
    signIn: (session: Omit<DeanSession, "isAuthenticated">) => void
    signOut: () => void

    // Connectivity actions — these call the API client, then sync local state
    fetchActivities: () => Promise<void>
    approveActivity: (id: string, comment?: string) => Promise<void>
    denyActivity: (id: string, comment: string) => Promise<void>

    // Local-only mutations (e.g. optimistic UI, filtering) — do not use these
    // in place of the connectivity actions above for actual approve/deny
    setSelectedActivityId: (id: string | null) => void
    setFilterStatus: (status: ActivityStatus | "All" | null) => void
    setSearchQuery: (query: string) => void
}

export const getStatusBadgeColor = (status: ActivityStatus): string => {
    switch (status) {
        case "Approved":
            return "bg-emerald-100 text-emerald-800 border-emerald-300"
        case "Under Review":
            return "bg-amber-100 text-amber-800 border-amber-300"
        case "Pending Dean Approval":
            return "bg-blue-100 text-blue-800 border-blue-300"
        case "Needs Revision":
            return "bg-red-100 text-red-800 border-red-200"
        case "Rejected":
            return "bg-neutral-100 text-neutral-800 border-neutral-300"
        default:
            return "bg-neutral-100 text-neutral-800 border-neutral-200"
    }
}

export const computeStats = (activities: ActivityProposal[]): DashboardStats => {
    const pending = activities.filter(
        (a) => a.status === "Under Review" || a.status === "Pending Dean Approval"
    ).length
    const approved = activities.filter((a) => a.status === "Approved").length
    const revision = activities.filter((a) => a.status === "Needs Revision").length
    const total = activities.length

    return {
        pendingProposals: String(pending),
        approvedActivities: String(approved),
        needsRevision: String(revision),
        totalSubmissions: String(total),
        submissionsTerm: "AY 2026 - 2027",
    }
}

const EMPTY_SESSION: DeanSession = {
    name: null,
    title: null,
    office: null,
    email: null,
    isAuthenticated: false,
}

export const useDeanDashboardSessionStore = create<DeanDashboardSessionState>()(
    persist(
        (set) => ({
            session: EMPTY_SESSION,
            activities: [],
            stats: computeStats([]),
            isLoadingActivities: false,
            activitiesError: null,
            selectedActivityId: null,
            filterStatus: null,
            searchQuery: "",

            signIn: (session) => {
                set({ session: { ...session, isAuthenticated: true } })
            },

            signOut: () => {
                set({
                    session: EMPTY_SESSION,
                    activities: [],
                    stats: computeStats([]),
                    selectedActivityId: null,
                })
            },

            fetchActivities: async () => {
                set({ isLoadingActivities: true, activitiesError: null })
                try {
                    const activities = await fetchMyQueue()
                    set({ activities, stats: computeStats(activities), isLoadingActivities: false })
                } catch (err) {
                    set({
                        activitiesError: err instanceof Error ? err.message : "Failed to load submissions",
                        isLoadingActivities: false,
                    })
                }
            },

            approveActivity: async (id) => {
                const updated = await approveActivityRequest(id)
                set((state) => {
                    const activities = state.activities.map((a) => (a.id === id ? { ...a, ...updated } : a))
                    return { activities, stats: computeStats(activities) }
                })
            },

            denyActivity: async (id) => {
                const updated = await denyActivityRequest(id)
                set((state) => {
                    const activities = state.activities.map((a) => (a.id === id ? { ...a, ...updated } : a))
                    return { activities, stats: computeStats(activities) }
                })
            },

            setSelectedActivityId: (selectedActivityId) => set({ selectedActivityId }),
            setFilterStatus: (filterStatus) => set({ filterStatus }),
            setSearchQuery: (searchQuery) => set({ searchQuery }),
        }),
        {
            name: "apex-dean-dashboard-session-store",
            storage: createJSONStorage(() => localStorage),
            // Only persist local UI preferences — never session/auth state or
            // fetched activity data, which must always come fresh from the API
            partialize: (state) => ({
                filterStatus: state.filterStatus,
                searchQuery: state.searchQuery,
            }),
        }
    )
)

export const useDeanDashboardStore = useDeanDashboardSessionStore
export default useDeanDashboardSessionStore