import type { AuthProviderProps } from "react-oidc-context"

const authority = import.meta.env.VITE_COGNITO_AUTHORITY
const client_id = import.meta.env.VITE_COGNITO_CLIENT_ID
const redirect_uri = import.meta.env.VITE_COGNITO_REDIRECT_URI
const post_logout_redirect_uri = import.meta.env.VITE_COGNITO_POST_LOGOUT_REDIRECT_URI
const scope = import.meta.env.VITE_COGNITO_SCOPES || "openid profile email"
const domain = import.meta.env.VITE_COGNITO_DOMAIN

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id,
  redirect_uri,
  response_type: "code",
  scope,
  post_logout_redirect_uri,
  automaticSilentRenew: true,
  // Cognito doesn't expose the end_session_endpoint in its openid-configuration
  // so we must provide it manually to make signoutRedirect work.
  metadata: {
    issuer: authority,
    authorization_endpoint: `${domain}/oauth2/authorize`,
    token_endpoint: `${domain}/oauth2/token`,
    userinfo_endpoint: `${domain}/oauth2/userInfo`,
    end_session_endpoint: `${domain}/logout`,
    revocation_endpoint: `${domain}/oauth2/revoke`,
    jwks_uri: `${authority}/.well-known/jwks.json`,
  },
  onSigninCallback: () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    )
  },
}
