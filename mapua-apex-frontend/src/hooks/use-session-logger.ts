import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { apiClient } from "../lib/api-client";
import { getPageName } from "../lib/page-names";
import type { PageVisit } from "../types/logs";

const HEARTBEAT_INTERVAL_MS = 90 * 1000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const SESSION_STORAGE_KEY = "apex_session_id";

/** Shared across all tabs in the same browser via localStorage. */
function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionId(id: string): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

function clearStoredSessionId(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface SessionResponse {
  sessionId: string;
  status: string;
  isNewSession?: boolean;
}

export function useSessionLogger() {
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(getStoredSessionId());
  const pendingPagesRef = useRef<PageVisit[]>([]);
  const lastActiveTimestampRef = useRef<number>(0);
  const isOpeningRef = useRef<boolean>(false);

  useEffect(() => {
    lastActiveTimestampRef.current = Date.now();
  }, []);

  useEffect(() => {
    try {
      const currentPath = location.pathname + location.search;
      const pageName = getPageName(location.pathname);
      const timestamp = new Date().toISOString();

      const pages = pendingPagesRef.current;
      const lastPage = pages.length > 0 ? pages[pages.length - 1] : null;

      if (!lastPage || lastPage.path !== currentPath) {
        pendingPagesRef.current.push({
          path: currentPath,
          pageName,
          timestamp,
        });
      }
    } catch (err) {
      console.warn("useSessionLogger: Page visit tracking failed", err);
    }
  }, [location]);

  useEffect(() => {
    const handleUserActivity = () => {
      lastActiveTimestampRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });
    window.addEventListener("scroll", handleUserActivity, { passive: true });
    window.addEventListener("click", handleUserActivity, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("scroll", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
    };
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const openSession = async () => {
      if (isOpeningRef.current) return;
      isOpeningRef.current = true;

      try {
        const pages = [...pendingPagesRef.current];
        pendingPagesRef.current = [];

        // Pass the existing session ID so the backend can resume it (same browser)
        // or close it and issue a new one (different device / concurrent login).
        const existingSessionId = getStoredSessionId();

        const res = await apiClient.post<SessionResponse>("/sessions/start", {
          pagesVisited: pages,
          existingSessionId: existingSessionId ?? undefined,
        });

        if (res && res.sessionId) {
          sessionIdRef.current = res.sessionId;
          setStoredSessionId(res.sessionId);
        }
      } catch (err) {
        console.warn("useSessionLogger: Open session failed", err);
      } finally {
        isOpeningRef.current = false;
      }
    };

    const sendHeartbeat = async () => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) {
        await openSession();
        return;
      }

      const idleTime = Date.now() - lastActiveTimestampRef.current;
      if (idleTime > IDLE_TIMEOUT_MS) {
        console.warn("useSessionLogger: User idle for 10+ min, skipping heartbeat");
        return;
      }

      try {
        const pages = [...pendingPagesRef.current];
        pendingPagesRef.current = [];

        await apiClient.patch(`/sessions/${currentSessionId}/heartbeat`, {
          pagesVisited: pages,
        });
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 409 || status === 404) {
          console.warn("useSessionLogger: Session expired/ended. Re-opening session...");
          sessionIdRef.current = null;
          clearStoredSessionId();
          await openSession();
        } else {
          console.warn("useSessionLogger: Heartbeat failed", err);
        }
      }
    };

    // Keep all tabs in this browser synced in real-time when localStorage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_STORAGE_KEY) {
        sessionIdRef.current = e.newValue;
      }
    };
    window.addEventListener("storage", onStorage);

    // On mount: if we already have a session ID from localStorage, heartbeat it first
    // (validates it's still active on the backend). Otherwise open a new session.
    if (sessionIdRef.current) {
      sendHeartbeat();
    } else {
      openSession();
    }

    intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return {
    getSessionId: () => sessionIdRef.current,
  };
}
