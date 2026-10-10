import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { apiClient } from "../lib/api-client";
import { getPageName } from "../lib/page-names";
import type { PageVisit } from "../types/logs";

const HEARTBEAT_INTERVAL_MS = 90 * 1000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

interface SessionResponse {
  sessionId: string;
  status: string;
}

export function useSessionLogger() {
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem("apex_session_id") : null
  );
  const pendingPagesRef = useRef<PageVisit[]>([]);
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const isOpeningRef = useRef<boolean>(false);

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

        const res = await apiClient.post<SessionResponse>("/sessions/start", {
          pagesVisited: pages,
        });

        if (res && res.sessionId) {
          sessionIdRef.current = res.sessionId;
          sessionStorage.setItem("apex_session_id", res.sessionId);
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
      } catch (err: any) {
        if (err?.status === 409 || err?.status === 404) {
          console.warn("useSessionLogger: Session expired/ended. Re-opening session...");
          sessionIdRef.current = null;
          sessionStorage.removeItem("apex_session_id");
          await openSession();
        } else {
          console.warn("useSessionLogger: Heartbeat failed", err);
        }
      }
    };

    // On mount, if we already have a session ID from sessionStorage, send heartbeat; otherwise open new session
    if (sessionIdRef.current) {
      sendHeartbeat();
    } else {
      openSession();
    }

    intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return {
    getSessionId: () => sessionIdRef.current,
  };
}
