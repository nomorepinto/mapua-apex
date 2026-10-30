/**
 * Direct AWS Cognito Identity Provider Authentication Service
 *
 * Implements InitiateAuth (USER_PASSWORD_AUTH), the NEW_PASSWORD_REQUIRED
 * challenge for admin-created temporary passwords, SignUp, ConfirmSignUp,
 * ResendConfirmationCode, ForgotPassword, and ConfirmForgotPassword.
 * Synchronizes session with OIDC storage format for seamless app-wide integration.
 */

export interface CognitoSessionData {
  id_token: string
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  profile: Record<string, unknown>
}

export interface CognitoAuthError {
  code: string
  message: string
}

/** Cognito session for an admin-created account that still has a temporary password. */
export interface NewPasswordChallenge {
  code: "NEW_PASSWORD_REQUIRED"
  message: string
  session: string
  username: string
  requiredAttributes: string[]
}

export function isNewPasswordChallenge(
  err: unknown
): err is NewPasswordChallenge {
  if (!err || typeof err !== "object") return false
  const candidate = err as Partial<NewPasswordChallenge>
  return (
    candidate.code === "NEW_PASSWORD_REQUIRED" &&
    typeof candidate.session === "string" &&
    candidate.session.length > 0 &&
    typeof candidate.username === "string" &&
    candidate.username.length > 0 &&
    Array.isArray(candidate.requiredAttributes)
  )
}

function getCognitoConfig() {
  const authority = import.meta.env.VITE_COGNITO_AUTHORITY || ""
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || ""

  // Extract region from authority URL (e.g., https://cognito-idp.ap-southeast-1.amazonaws.com/...)
  const match = authority.match(/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com/)
  const region = match ? match[1] : "ap-southeast-1"
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`

  return { authority, clientId, region, endpoint }
}

function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return {}
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(jsonPayload)
  } catch {
    return {}
  }
}

/**
 * Stores tokens into sessionStorage matching react-oidc-context's format
 * so that getIdToken(), getCognitoIdToken(), and AuthGuard recognize the session.
 */
export function storeCognitoSession(tokens: {
  IdToken: string
  AccessToken: string
  RefreshToken?: string
  ExpiresIn?: number
}): CognitoSessionData {
  const { authority, clientId } = getCognitoConfig()
  const profile = parseJwt(tokens.IdToken)
  const expiresIn = tokens.ExpiresIn || 3600
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn

  const sessionData: CognitoSessionData = {
    id_token: tokens.IdToken,
    access_token: tokens.AccessToken,
    refresh_token: tokens.RefreshToken,
    expires_in: expiresIn,
    token_type: "Bearer",
    profile,
  }

  const oidcStorageValue = JSON.stringify({
    ...sessionData,
    expires_at: expiresAt,
    scope: "openid profile email",
  })

  // Primary key used by oidc-client-ts
  if (authority && clientId) {
    const key = `oidc.user:${authority}:${clientId}`
    sessionStorage.setItem(key, oidcStorageValue)
  }

  // Fallback storage item
  sessionStorage.setItem(
    "apex_current_user",
    JSON.stringify({
      email: profile.email || profile["cognito:username"],
      name: profile.name,
      groups: profile["cognito:groups"] || [],
    })
  )

  // Fresh sign-in: reset idle tracking timestamp to now and clear old session ID
  try {
    localStorage.setItem("apex_last_active_at", Date.now().toString())
    localStorage.removeItem("apex_session_id")
  } catch {
    // ignore
  }

  return sessionData
}

/**
 * Maps raw AWS error types to friendly, actionable messages
 */
export function mapCognitoError(
  errorType: string,
  rawMessage: string
): CognitoAuthError {
  const type = errorType.split("#").pop() || errorType

  switch (type) {
    case "NotAuthorizedException":
      if (rawMessage.toLowerCase().includes("signup is not permitted")) {
        return {
          code: type,
          message:
            "Self-service sign-up is currently disabled in your AWS Cognito User Pool. Please enable 'Allow self-service sign-up' in the AWS Console.",
        }
      }
      if (rawMessage.toLowerCase().includes("session")) {
        return {
          code: type,
          message:
            "This sign-in step expired. Sign in again with your temporary password.",
        }
      }
      return {
        code: type,
        message:
          rawMessage ||
          "Incorrect email or password. Please verify your credentials.",
      }
    case "UserNotFoundException":
      return {
        code: type,
        message:
          "No account found with this email. Please check your spelling or create an account.",
      }
    case "UserNotConfirmedException":
      return {
        code: type,
        message:
          "Your email address is not yet verified. Please enter the verification code sent to your inbox.",
      }
    case "UsernameExistsException":
      return {
        code: type,
        message:
          "An account with this email address already exists. Please sign in instead.",
      }
    case "InvalidPasswordException":
      if (/previous|history/i.test(rawMessage)) {
        return {
          code: type,
          message:
            "Choose a password that is different from your temporary password.",
        }
      }
      return {
        code: type,
        message:
          "Password does not meet requirements: must be at least 8 characters with numbers, lowercase, and uppercase letters.",
      }
    case "PasswordHistoryPolicyViolationException":
      return {
        code: type,
        message:
          "Choose a password that is different from your temporary password.",
      }
    case "CodeMismatchException":
      return {
        code: type,
        message:
          "Invalid verification code. Please check your email and try again.",
      }
    case "ExpiredCodeException":
      return {
        code: type,
        message:
          "This verification code has expired. Please request a new code.",
      }
    case "LimitExceededException":
    case "TooManyRequestsException":
      return {
        code: type,
        message:
          "Too many attempts. For your security, please wait a moment before trying again.",
      }
    case "InvalidParameterException":
      return {
        code: type,
        message:
          rawMessage ||
          "Invalid information provided. Please check all fields.",
      }
    default:
      return {
        code: type,
        message:
          rawMessage || "An authentication error occurred. Please try again.",
      }
  }
}

async function callCognitoApi(target: string, body: Record<string, unknown>) {
  const { endpoint } = getCognitoConfig()

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    const errorType =
      data.__type || response.headers.get("x-amzn-errortype") || "Error"
    const error = mapCognitoError(errorType, data.message || "")
    throw error
  }

  return data
}

function parseRequiredAttributes(raw: unknown): string[] {
  let values: unknown = raw
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      values = JSON.parse(trimmed)
    } catch {
      return []
    }
  }
  if (!Array.isArray(values)) return []

  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().replace(/^userAttributes\./, ""))
    .filter((item) => item.length > 0)
}

function readNewPasswordChallenge(
  data: {
    Session?: string
    ChallengeParameters?: {
      USER_ID_FOR_SRP?: string
      requiredAttributes?: unknown
    }
  },
  fallbackUsername: string
): NewPasswordChallenge {
  const session = typeof data.Session === "string" ? data.Session : ""
  const username = data.ChallengeParameters?.USER_ID_FOR_SRP || fallbackUsername
  if (!session || !username) {
    throw {
      code: "NEW_PASSWORD_REQUIRED",
      message:
        "Password change is required, but Cognito did not return a session. Sign in again.",
    }
  }

  return {
    code: "NEW_PASSWORD_REQUIRED",
    message:
      "This account is using a temporary password. Set a new password to continue.",
    session,
    username,
    requiredAttributes: parseRequiredAttributes(
      data.ChallengeParameters?.requiredAttributes
    ),
  }
}

/**
 * 1. Sign In via USER_PASSWORD_AUTH
 */
export async function cognitoSignIn(
  username: string,
  password: string
): Promise<CognitoSessionData> {
  const { clientId } = getCognitoConfig()
  const cleanUsername = username.trim()

  const data = await callCognitoApi("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: cleanUsername,
      PASSWORD: password,
    },
  })

  if (data.AuthenticationResult) {
    const session = storeCognitoSession(data.AuthenticationResult)
    return session
  }

  if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    throw readNewPasswordChallenge(data, cleanUsername)
  }

  throw {
    code: "UnknownChallenge",
    message: `Authentication challenge received: ${data.ChallengeName}`,
  }
}

/**
 * Completes the NEW_PASSWORD_REQUIRED challenge from an admin-created account.
 * `attributes` are only the attributes Cognito listed in requiredAttributes.
 */
export async function cognitoCompleteNewPassword(
  username: string,
  newPassword: string,
  session: string,
  attributes: Record<string, string> = {}
): Promise<CognitoSessionData> {
  const { clientId } = getCognitoConfig()
  const challengeResponses: Record<string, string> = {
    USERNAME: username,
    NEW_PASSWORD: newPassword,
  }

  for (const [key, value] of Object.entries(attributes)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const name = key.startsWith("userAttributes.")
      ? key
      : `userAttributes.${key}`
    challengeResponses[name] = trimmed
  }

  const data = await callCognitoApi("RespondToAuthChallenge", {
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    ClientId: clientId,
    Session: session,
    ChallengeResponses: challengeResponses,
  })

  if (data.AuthenticationResult) {
    return storeCognitoSession(data.AuthenticationResult)
  }

  if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    throw readNewPasswordChallenge(data, username)
  }

  throw {
    code: data.ChallengeName || "UnknownChallenge",
    message: data.ChallengeName
      ? `Additional verification is required (${data.ChallengeName}). This sign-in screen cannot complete that step.`
      : "Password was not updated. Please try again.",
  }
}

/**
 * 2. Sign Up
 */
export async function cognitoSignUp(
  fullName: string,
  email: string,
  password: string
) {
  const { clientId } = getCognitoConfig()
  const cleanEmail = email.trim()

  const data = await callCognitoApi("SignUp", {
    ClientId: clientId,
    Username: cleanEmail,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: cleanEmail },
      { Name: "name", Value: fullName.trim() },
    ],
  })

  return {
    userConfirmed: Boolean(data.UserConfirmed),
    userSub: data.UserSub as string,
  }
}

/**
 * 3. Confirm Sign Up with Email Verification Code
 */
export async function cognitoConfirmSignUp(
  email: string,
  confirmationCode: string
) {
  const { clientId } = getCognitoConfig()
  const cleanEmail = email.trim()
  const cleanCode = confirmationCode.trim()

  await callCognitoApi("ConfirmSignUp", {
    ClientId: clientId,
    Username: cleanEmail,
    ConfirmationCode: cleanCode,
  })

  return true
}

/**
 * 4. Resend Confirmation Code
 */
export async function cognitoResendConfirmationCode(email: string) {
  const { clientId } = getCognitoConfig()
  const cleanEmail = email.trim()

  const data = await callCognitoApi("ResendConfirmationCode", {
    ClientId: clientId,
    Username: cleanEmail,
  })

  return data.CodeDeliveryDetails
}

/**
 * 5. Forgot Password (Initiate)
 */
export async function cognitoForgotPassword(email: string) {
  const { clientId } = getCognitoConfig()
  const cleanEmail = email.trim()

  const data = await callCognitoApi("ForgotPassword", {
    ClientId: clientId,
    Username: cleanEmail,
  })

  return data.CodeDeliveryDetails
}

/**
 * 6. Confirm Forgot Password
 */
export async function cognitoConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
) {
  const { clientId } = getCognitoConfig()
  const cleanEmail = email.trim()

  await callCognitoApi("ConfirmForgotPassword", {
    ClientId: clientId,
    Username: cleanEmail,
    ConfirmationCode: code.trim(),
    Password: newPassword,
  })

  return true
}

/**
 * 7. Sign Out
 */
export function cognitoSignOut() {
  const { authority, clientId } = getCognitoConfig()
  if (authority && clientId) {
    sessionStorage.removeItem(`oidc.user:${authority}:${clientId}`)
  }
  sessionStorage.removeItem("apex_current_user")
}
