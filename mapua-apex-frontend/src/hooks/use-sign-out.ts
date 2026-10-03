import { useCallback } from "react"

export function useSignOut() {
  return useCallback(() => {
    // Cognito's /logout endpoint expects `client_id` + `logout_uri`,
    // NOT the standard OIDC `post_logout_redirect_uri` that oidc-client-ts sends.
    const domain = import.meta.env.VITE_COGNITO_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const authority = import.meta.env.VITE_COGNITO_AUTHORITY
    const logoutUri = import.meta.env.VITE_COGNITO_POST_LOGOUT_REDIRECT_URI

    // Clear the OIDC user data directly from storage (synchronous).
    // We CANNOT use auth.removeUser() because even fire-and-forget,
    // its resolved promise triggers a React re-render where AuthGuard
    // calls signinRedirect() — overriding our logout redirect.
    const storageKey = `oidc.user:${authority}:${clientId}`
    sessionStorage.removeItem(storageKey)

    // Redirect to Cognito's logout endpoint with correct params
    window.location.href = `${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
  }, [])
}
