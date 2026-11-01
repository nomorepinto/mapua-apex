import { useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { clearStoredLastActive } from "@/hooks/use-session-logger";

export function useSignOut() {
  return useCallback(async (options?: {
    skipSessionEnd?: boolean
    /** Stay in the app. Used when Cognito hosted logout is not a session this user has. */
    localOnly?: boolean
  }) => {
    // End session in backend logger before Cognito redirect
    const sessionId = localStorage.getItem("apex_session_id");
    if (sessionId && !options?.skipSessionEnd) {
      try {
        await apiClient.post(`/sessions/${sessionId}/end`, { reason: "logout" });
      } catch (err) {
        console.warn("useSignOut: end session call failed", err);
      }
    }
    localStorage.removeItem("apex_session_id");
    clearStoredLastActive();

    // Cognito's /logout endpoint expects `client_id` + `logout_uri`,
    // NOT the standard OIDC `post_logout_redirect_uri` that oidc-client-ts sends.
    const domain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
    const logoutUri = import.meta.env.VITE_COGNITO_POST_LOGOUT_REDIRECT_URI;

    // Clear the OIDC user data directly from storage (synchronous).
    if (authority && clientId) {
      const storageKey = `oidc.user:${authority}:${clientId}`;
      sessionStorage.removeItem(storageKey);
    }
    sessionStorage.removeItem("apex_current_user");

    // Unassigned accounts sign in through the in-app form, so Cognito's hosted
    // logout page has nothing to end and shows an error. Return to the landing page.
    if (options?.localOnly || !domain || !clientId || !logoutUri) {
      if (window.location.pathname === "/") {
        window.location.reload();
      } else {
        window.location.replace("/");
      }
      return;
    }

    // Redirect to Cognito's logout endpoint with correct params
    window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  }, []);
}

