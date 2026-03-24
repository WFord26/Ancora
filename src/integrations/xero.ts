/**
 * Xero OAuth 2.0 integration helpers.
 *
 * Required environment variables:
 *   XERO_CLIENT_ID      — App client ID from developer.xero.com
 *   XERO_CLIENT_SECRET  — App client secret
 *   XERO_REDIRECT_URI   — e.g. https://yourapp.com/api/integrations/callback?provider=xero
 */

const XERO_OAUTH_BASE = "https://login.xero.com/identity/connect/authorize"
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions",
  "accounting.contacts",
  "offline_access",
].join(" ")

export type OAuthTokens = {
  accessToken: string
  refreshToken: string
  expiry: Date
}

/**
 * Build the Xero authorization URL.
 */
export function buildXeroOAuthUrl(tenantId: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID ?? "",
    redirect_uri: process.env.XERO_REDIRECT_URI ?? "",
    scope: XERO_SCOPES,
    state: encodeState(tenantId),
  })
  return `${XERO_OAUTH_BASE}?${params.toString()}`
}

/**
 * Verify the state param from the Xero callback.
 */
export function verifyXeroState(state: string): string | null {
  return decodeState(state)
}

/**
 * Exchange an authorization code for Xero access + refresh tokens.
 */
export async function exchangeXeroCode(code: string): Promise<OAuthTokens> {
  const credentials = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString("base64")

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI ?? "",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Xero token exchange failed: ${text}`)
  }

  const json = await res.json()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiry: new Date(Date.now() + json.expires_in * 1000),
  }
}

/**
 * Refresh an expired Xero access token.
 */
export async function refreshXeroTokens(refreshToken: string): Promise<OAuthTokens> {
  const credentials = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString("base64")

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Xero token refresh failed: ${text}`)
  }

  const json = await res.json()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiry: new Date(Date.now() + json.expires_in * 1000),
  }
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function encodeState(tenantId: string): string {
  return Buffer.from(JSON.stringify({ tenantId })).toString("base64url")
}

function decodeState(state: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"))
    return typeof payload.tenantId === "string" ? payload.tenantId : null
  } catch {
    return null
  }
}
