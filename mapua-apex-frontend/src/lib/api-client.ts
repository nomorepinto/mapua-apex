/**
 * APEX API Client
 *
 * Sends the Cognito ID token and the matching role X-Api-Key required by /api/v1.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1"

const API_TOKEN_STUDENT = import.meta.env.VITE_API_TOKEN_STUDENT as string | undefined
const API_TOKEN_SIGNATORY = import.meta.env.VITE_API_TOKEN_SIGNATORY as
  | string
  | undefined
const API_TOKEN_ADMIN = import.meta.env.VITE_API_TOKEN_ADMIN as string | undefined

const ADMIN_GROUPS = new Set(["admin", "osaar", "Admin", "OSAAR"])
const SIGNATORY_GROUPS = new Set([
  "signatory",
  "CDM_Reviewer",
  "Dean",
  "ORG_Adviser",
])
const STUDENT_GROUPS = new Set(["student", "ORG_Submitter"])

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padLength = (4 - (padded.length % 4)) % 4
    const json = atob(padded + "=".repeat(padLength))
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function getCognitoGroups(token: string | null): string[] {
  if (!token) return []
  const payload = decodeJwtPayload(token)
  const groups = payload?.["cognito:groups"]
  if (Array.isArray(groups)) return groups.map(String)
  if (typeof groups === "string") return [groups]
  return []
}

function groupsOverlap(groups: string[], allowed: Set<string>): boolean {
  return groups.some((group) => allowed.has(group))
}

function isEndpoint(endpoint: string, prefix: string): boolean {
  const path = endpoint.replace(/^\//, "")
  return path.startsWith(prefix)
}

/**
 * Pick the role API key from Cognito groups, falling back to the request path.
 * Admin tokens may also be used on student and signatory routes.
 */
export function getApiKeyForRequest(endpoint: string, token: string | null): string | undefined {
  const groups = getCognitoGroups(token)

  if (groupsOverlap(groups, ADMIN_GROUPS)) return API_TOKEN_ADMIN
  if (groupsOverlap(groups, SIGNATORY_GROUPS)) return API_TOKEN_SIGNATORY
  if (groupsOverlap(groups, STUDENT_GROUPS)) return API_TOKEN_STUDENT

  if (isEndpoint(endpoint, "admins/")) return API_TOKEN_ADMIN
  if (isEndpoint(endpoint, "signatories/")) return API_TOKEN_SIGNATORY
  if (isEndpoint(endpoint, "students/")) return API_TOKEN_STUDENT

  return API_TOKEN_ADMIN
}

/**
 * Retrieves the current Cognito ID token from OIDC session storage.
 */
export function getCognitoIdToken(): string | null {
  try {
    const authority = import.meta.env.VITE_COGNITO_AUTHORITY
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const storageKey = authority && clientId ? `oidc.user:${authority}:${clientId}` : null

    const storages = [sessionStorage, localStorage]

    for (const storage of storages) {
      if (storageKey) {
        const raw = storage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed.id_token) {
            return parsed.id_token as string
          }
        }
      }

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key && key.startsWith("oidc.user:")) {
          const raw = storage.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed.id_token) {
              return parsed.id_token as string
            }
          }
        }
      }
    }

    return null
  } catch (error) {
    console.warn("Failed to retrieve Cognito token from storage", error)
    return null
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers = {}, ...customConfig } = options

  let url = `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`

  if (params) {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value))
      }
    })
    const queryString = queryParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const token = getCognitoIdToken()
  const apiKey = getApiKeyForRequest(endpoint, token)

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(headers as Record<string, string>),
  }

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`
  }

  if (apiKey) {
    reqHeaders["X-Api-Key"] = apiKey
  }

  const sessionId = typeof window !== "undefined" ? localStorage.getItem("apex_session_id") : null
  if (sessionId) {
    reqHeaders["X-Session-ID"] = sessionId
  }

  const deviceId = typeof window !== "undefined" ? localStorage.getItem("apex_device_id") : null
  if (deviceId) {
    reqHeaders["X-Device-ID"] = deviceId
  }

  const response = await fetch(url, {
    ...customConfig,
    headers: reqHeaders,
  })

  if (!response.ok) {
    let errorData: unknown
    try {
      errorData = await response.json()
    } catch {
      errorData = await response.text()
    }

    // Intercept displacement or revocation immediately
    if (response.status === 409 && typeof errorData === "object" && errorData !== null) {
      const code = (errorData as { code?: string }).code
      if (code === "CONCURRENT_LOGIN_DISPLACED") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("apex:session_displaced"))
        }
      } else if (code === "SESSION_REVOKED") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("apex:session_revoked"))
        }
      }
    }

    const message =
      typeof errorData === "object" && errorData !== null && "message" in errorData
        ? String((errorData as { message: unknown }).message)
        : `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, errorData)
  }

  if (response.status === 204) {
    return {} as T
  }

  const json = await response.json()
  return json as T
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" })
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" })
  },
}
