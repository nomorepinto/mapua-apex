import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { apiClient, getCognitoIdToken, getApiKeyForRequest } from "../lib/api-client";
import { getPageName } from "../lib/page-names";
import type { PageVisit } from "../types/logs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const HEARTBEAT_INTERVAL_MS = 90 * 1000;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

interface SessionResponse {
  sessionId: string;
  status: string;
}

export function useSessionLogger() {
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
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
        if (err?.status === 409) {
          console.warn("useSessionLogger: 409 Session expired/ended. Re-opening session...");
          sessionIdRef.current = null;
          sessionStorage.removeItem("apex_session_id");
          await openSession();
        } else {
          console.warn("useSessionLogger: Heartbeat failed", err);
        }
      }
    };

    openSession();
    intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const handleUnload = () => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;

      try {
        const token = getCognitoIdToken();
        const endpoint = `sessions/${currentSessionId}/end`;
        const apiKey = getApiKeyForRequest(endpoint, token);
        const url = `${API_BASE_URL.replace(/\/$/, "")}/${endpoint}`;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (apiKey) headers["X-Api-Key"] = apiKey;
        if (currentSessionId) headers["X-Session-ID"] = currentSessionId;

        fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ reason: "tab_closed" }),
          keepalive: true,
        }).catch(() => {});
      } catch (err) {
        console.warn("useSessionLogger: end session fetch failed", err);
      }
    };

    window.addEventListener("pagehide", handleUnload);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, []);

  return {
    getSessionId: () => sessionIdRef.current,
  };
}
