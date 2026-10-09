import { useCallback } from "react";

export function useSignOut() {
  return useCallback((evtOrSessionId?: string | null | React.MouseEvent) => {
    const sessionId = typeof evtOrSessionId === "string" ? evtOrSessionId : null;

    // End session keepalive call before Cognito redirect
    try {
      if (sessionId) {
        const url = `/api/v1/sessions/${sessionId}/end`;
        const blob = new Blob([JSON.stringify({ reason: "logout" })], {
          type: "application/json",
        });
        navigator.sendBeacon(url, blob);
      }
    } catch (err) {
      console.warn("useSignOut: end session beacon failed", err);
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
