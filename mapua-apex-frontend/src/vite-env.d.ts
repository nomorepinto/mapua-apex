/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_AUTHORITY: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_COGNITO_DOMAIN: string
  readonly VITE_COGNITO_REDIRECT_URI: string
  readonly VITE_COGNITO_POST_LOGOUT_REDIRECT_URI: string
  readonly VITE_COGNITO_SCOPES: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TOKEN_STUDENT?: string
  readonly VITE_API_TOKEN_SIGNATORY?: string
  readonly VITE_API_TOKEN_ADMIN?: string
  // "true" serves the admin monitor pages from local sample data.
  readonly VITE_MOCK_MONITOR?: string
  readonly VITE_SIGNIN_INACTIVITY_TIMEOUT_SECONDS?: string
  readonly VITE_SIGNUP_INACTIVITY_TIMEOUT_SECONDS?: string
  readonly VITE_ARCUS_ATTENDANCE_URL: string
  readonly VITE_ARCUS_EVALUATION_URL: string
  // Clock display format: "12" or "24" (defaults to 12 when unset).
  readonly VITE_TIME_FORMAT?: string
  // Local-only: lifts the 10-day minimum event-date lead when "true".
  readonly VITE_ALLOW_ANY_EVENT_DATE?: string
  // Turns the gibberish input check on/off ("true" to enable). Mirrors the
  // backend GIBBERISH_CHECK_ENABLED flag; unset/false keeps the feature inert.
  readonly VITE_GIBBERISH_CHECK_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
