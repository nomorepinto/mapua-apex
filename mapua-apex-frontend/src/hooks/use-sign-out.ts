import { useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export function useSignOut() {
  return useCallback(async (evtOrSessionId?: string | null | React.MouseEvent) => {
    const passedSessionId = typeof evtOrSessionId === "string" ? evtOrSessionId : null;
    const sessionId = passedSessionId || sessionStorage.getItem("apex_session_id");

    // End session call before Cognito redirect
    try {
      if (sessionId) {
        await apiClient.post(`/sessions/${sessionId}/end`, { endReason: "logout" });
        sessionStorage.removeItem("apex_session_id");
      }
    } catch (err) {
      console.warn("useSignOut: end session call failed", err);
    }

    const domain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
    const logoutUri = import.meta.env.VITE_COGNITO_POST_LOGOUT_REDIRECT_URI;

    // Clear OIDC session storage
    if (authority && clientId) {
      const storageKey = `oidc.user:${authority}:${clientId}`;
      sessionStorage.removeItem(storageKey);
    }

    // Redirect to Cognito logout endpoint
    if (domain && clientId && logoutUri) {
      window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
    } else {
      window.location.href = "/";
    }
  }, []);
}
