import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import {
  apiClient,
  notifySessionFailed,
  notifySessionReady,
} from "../lib/api-client"
import { getPageName } from "../lib/page-names"
import type { PageVisit } from "../types/logs"

const HEARTBEAT_INTERVAL_MS = 90 * 1000
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const SESSION_STORAGE_KEY = "apex_session_id"
const DEVICE_STORAGE_KEY = "apex_device_id"
const LAST_ACTIVE_STORAGE_KEY = "apex_last_active_at"

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem(DEVICE_STORAGE_KEY, id)
    }
    return id
  } catch {
    return "dev_fallback"
  }
}

/** Shared across all tabs in the same browser via localStorage. */
function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    return null
  }
}

function setStoredSessionId(id: string): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id)
  } catch {
    // ignore
  }
  notifySessionReady()
}

function sessionIdOf(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const record = body as {
    sessionId?: unknown
    data?: { sessionId?: unknown }
  }
  if (typeof record.sessionId === "string" && record.sessionId.trim() !== "") {
    return record.sessionId.trim()
  }
  const nested = record.data?.sessionId
  if (typeof nested === "string" && nested.trim() !== "") return nested.trim()
  return null
}

function clearStoredSessionId(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function getStoredLastActive(): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_STORAGE_KEY)
    return raw ? parseInt(raw, 10) || Date.now() : Date.now()
  } catch {
    return Date.now()
  }
}

export function setStoredLastActive(ts: number): void {
  try {
    localStorage.setItem(LAST_ACTIVE_STORAGE_KEY, ts.toString())
  } catch {
    // ignore
  }
}

export const isIdleExpired = (): boolean =>
  Date.now() - getStoredLastActive() > IDLE_TIMEOUT_MS

export const clearStoredLastActive = (): void => {
  try {
    localStorage.removeItem(LAST_ACTIVE_STORAGE_KEY)
  } catch {
    // ignore
  }
}

let lastGlobalHeartbeatSentAt = 0

interface SessionResponse {
  sessionId?: string
  status?: string
  isNewSession?: boolean
  displacedPreviousSession?: boolean
  data?: { sessionId?: string }
}

export function useSessionLogger() {
  const location = useLocation()
  const sessionIdRef = useRef<string | null>(getStoredSessionId())
  const openSessionRef = useRef<() => Promise<void>>(async () => {})
  const [ready, setReady] = useState(() => getStoredSessionId() !== null)
  const [failed, setFailed] = useState(false)
  const pendingPagesRef = useRef<PageVisit[]>([])
  const lastActiveTimestampRef = useRef<number>(getStoredLastActive())
  const lastStorageWriteRef = useRef<number>(0)
  const isOpeningRef = useRef<boolean>(false)
  const isTerminatedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!localStorage.getItem(LAST_ACTIVE_STORAGE_KEY)) {
      setStoredLastActive(Date.now())
    }
  }, [])

  useEffect(() => {
    try {
      const currentPath = location.pathname + location.search
      const pageName = getPageName(location.pathname)
      const timestamp = new Date().toISOString()

      const pages = pendingPagesRef.current
      const lastPage = pages.length > 0 ? pages[pages.length - 1] : null

      if (!lastPage || lastPage.path !== currentPath) {
        pendingPagesRef.current.push({
          path: currentPath,
          pageName,
          timestamp,
        })
      }
    } catch (err) {
      console.warn("useSessionLogger: Page visit tracking failed", err)
    }
  }, [location])

  useEffect(() => {
    const handleUserActivity = () => {
      if (isTerminatedRef.current || isIdleExpired()) return
      const now = Date.now()
      lastActiveTimestampRef.current = now
      if (now - lastStorageWriteRef.current > 5000) {
        lastStorageWriteRef.current = now
        setStoredLastActive(now)
      }
    }

    window.addEventListener("mousemove", handleUserActivity, { passive: true })
    window.addEventListener("keydown", handleUserActivity, { passive: true })
    window.addEventListener("scroll", handleUserActivity, { passive: true })
    window.addEventListener("click", handleUserActivity, { passive: true })

    return () => {
      window.removeEventListener("mousemove", handleUserActivity)
      window.removeEventListener("keydown", handleUserActivity)
      window.removeEventListener("scroll", handleUserActivity)
      window.removeEventListener("click", handleUserActivity)
    }
  }, [])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let idleCheckId: ReturnType<typeof setInterval> | null = null

    const openSession = async () => {
      if (isOpeningRef.current || isTerminatedRef.current) return
      isOpeningRef.current = true

      try {
        const pages = [...pendingPagesRef.current]
        pendingPagesRef.current = []

        const existingSessionId = getStoredSessionId()
        const deviceId = getOrCreateDeviceId()

        const res = await apiClient.post<SessionResponse>("/sessions/start", {
          pagesVisited: pages,
          existingSessionId: existingSessionId ?? undefined,
          deviceId,
        })

        const sessionId = sessionIdOf(res)
        if (sessionId) {
          sessionIdRef.current = sessionId
          setStoredSessionId(sessionId)
          setReady(true)
          setFailed(false)

          if (res?.displacedPreviousSession) {
            window.dispatchEvent(
              new CustomEvent("apex:session_displaced_previous")
            )
          }
        } else if (!getStoredSessionId()) {
          console.warn(
            "useSessionLogger: Open session returned no session id",
            res
          )
          setFailed(true)
          notifySessionFailed()
        }
      } catch (err) {
        console.warn("useSessionLogger: Open session failed", err)
        if (!getStoredSessionId()) {
          setFailed(true)
          notifySessionFailed()
        }
      } finally {
        isOpeningRef.current = false
      }
    }

    const sendHeartbeat = async () => {
      if (isTerminatedRef.current) return

      const now = Date.now()
      if (now - lastGlobalHeartbeatSentAt < 3000) return
      lastGlobalHeartbeatSentAt = now

      const currentSessionId = sessionIdRef.current
      if (!currentSessionId) {
        await openSession()
        return
      }

      const storedLastActive = getStoredLastActive()
      const lastActive = Math.max(
        lastActiveTimestampRef.current,
        storedLastActive
      )
      const idleTime = Date.now() - lastActive
      if (idleTime > IDLE_TIMEOUT_MS) {
        console.warn(
          "useSessionLogger: User idle for 15+ min, skipping heartbeat"
        )
        return
      }

      try {
        const pages = [...pendingPagesRef.current]
        pendingPagesRef.current = []

        await apiClient.patch(`/sessions/${currentSessionId}/heartbeat`, {
          pagesVisited: pages,
        })
      } catch (err) {
        const status = (err as { status?: number })?.status
        const errData = (err as { data?: { code?: string } })?.data
        const code = errData?.code

        if (code === "CONCURRENT_LOGIN_DISPLACED") {
          console.warn(
            "useSessionLogger: Session displaced by login on another device."
          )
          isTerminatedRef.current = true
          if (intervalId) clearInterval(intervalId)
          if (idleCheckId) clearInterval(idleCheckId)
          window.dispatchEvent(new CustomEvent("apex:session_displaced"))
          return // keep the stored ID so other tabs get their own 409 and modal
        }

        if (code === "SESSION_REVOKED") {
          console.warn("useSessionLogger: Session revoked by administrator.")
          isTerminatedRef.current = true
          if (intervalId) clearInterval(intervalId)
          if (idleCheckId) clearInterval(idleCheckId)
          window.dispatchEvent(new CustomEvent("apex:session_revoked"))
          return
        }

        if (code === "SESSION_EXPIRED" || status === 404) {
          console.warn(
            "useSessionLogger: Session expired. Refreshing session..."
          )
          sessionIdRef.current = null
          clearStoredSessionId()
          setReady(false)
          await openSession()
        } else {
          console.warn(
            "useSessionLogger: Heartbeat failed (transient network or cold start)",
            err
          )
        }
      }
    }

    // Keep all tabs in this browser synced in real-time when localStorage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_STORAGE_KEY && e.newValue) {
        sessionIdRef.current = e.newValue
        setReady(true)
        setFailed(false)
        notifySessionReady()
      }
      if (e.key === LAST_ACTIVE_STORAGE_KEY && e.newValue) {
        const parsed = parseInt(e.newValue, 10)
        if (parsed) {
          lastActiveTimestampRef.current = Math.max(
            lastActiveTimestampRef.current,
            parsed
          )
        }
      }
    }
    window.addEventListener("storage", onStorage)

    openSessionRef.current = openSession

    // Mount lifecycle: if a session ID exists in localStorage, validate it; otherwise open fresh
    if (sessionIdRef.current) {
      sendHeartbeat()
    } else {
      void openSession()
    }

    intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    idleCheckId = setInterval(() => {
      if (isTerminatedRef.current) return
      if (isIdleExpired()) {
        isTerminatedRef.current = true
        if (intervalId) clearInterval(intervalId)
        if (idleCheckId) clearInterval(idleCheckId)

        const sid = sessionIdRef.current
        if (sid) {
          apiClient
            .post(`/sessions/${sid}/end`, { reason: "timed_out" })
            .catch(() => {})
        }

        window.dispatchEvent(new CustomEvent("apex:session_timed_out"))
      }
    }, 15_000)

    return () => {
      if (intervalId) clearInterval(intervalId)
      if (idleCheckId) clearInterval(idleCheckId)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  return {
    ready,
    failed,
    retry: () => {
      setFailed(false)
      void openSessionRef.current()
    },
    getSessionId: () => sessionIdRef.current,
  }
}
