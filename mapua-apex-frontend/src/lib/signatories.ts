import { getIdToken } from "@/lib/auth"
import type { ActivityProposal } from "@/stores/deandb-session-store"

const BASE_URL = "http://localhost:8000/api/v1"

async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getIdToken()
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    })

    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Request failed: ${res.status}`)
    }

    return res.json()
}

/** GET /signatories/submissions — "my queue" for the signed-in signatory */
export function fetchMyQueue(): Promise<ActivityProposal[]> {
    return authedFetch<ActivityProposal[]>("/signatories/submissions")
}

/** GET /signatories/submissions/:submissionId */
export function fetchActivityDetail(id: string): Promise<ActivityProposal> {
    return authedFetch<ActivityProposal>(`/signatories/submissions/${id}`)
}

/** POST /signatories/submissions/:submissionId/approve */
export function approveActivity(id: string): Promise<ActivityProposal> {
    return authedFetch<ActivityProposal>(`/signatories/submissions/${id}/approve`, {
        method: "POST",
    })
}

/** POST /signatories/submissions/:submissionId/deny */
export function denyActivity(id: string): Promise<ActivityProposal> {
    return authedFetch<ActivityProposal>(`/signatories/submissions/${id}/deny`, {
        method: "POST",
    })
}