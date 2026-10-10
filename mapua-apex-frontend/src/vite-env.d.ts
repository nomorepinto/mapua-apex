/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_AUTHORITY: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_COGNITO_DOMAIN: string
  readonly VITE_COGNITO_REDIRECT_URI: string
  readonly VITE_COGNITO_POST_LOGOUT_REDIRECT_URI: string
  readonly VITE_COGNITO_SCOPES: string
  readonly VITE_ARCUS_ATTENDANCE_URL: string
  readonly VITE_ARCUS_EVALUATION_URL: string
  // Clock display format: "12" or "24" (defaults to 12 when unset).
  readonly VITE_TIME_FORMAT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
