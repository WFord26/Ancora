/**
 * QuickBooks Online OAuth 2.0 integration helpers.
 *
 * Required environment variables:
 *   QBO_CLIENT_ID      — App client ID from developer.intuit.com
 *   QBO_CLIENT_SECRET  — App client secret
 *   QBO_REDIRECT_URI   — e.g. https://yourapp.com/api/integrations/callback?provider=qbo
 */

const QBO_OAUTH_BASE = "https://appcenter.intuit.com/connect/oauth2"
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
const QBO_SCOPES = ["com.intuit.quickbooks.accounting"].join(" ")

export type OAuthTokens = {
  accessToken: string
  refreshToken: string
  expiry: Date
}

/**
 * Build the QBO authorization URL. The `state` param encodes the tenantId so we
 * can associate the callback with the correct tenant without a server-side session.
 */
export function buildOAuthUrl(tenantId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID ?? "",
    redirect_uri: process.env.QBO_REDIRECT_URI ?? "",
    response_type: "code",
    scope: QBO_SCOPES,
    state: encodeState(tenantId),
  })
  return `${QBO_OAUTH_BASE}?${params.toString()}`
}

/**
 * Verify the state param from the callback. Returns the tenantId or null if invalid.
 */
export function verifyQBOState(state: string): string | null {
  return decodeState(state)
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeQBOCode(
  code: string,
  _realmId: string
): Promise<OAuthTokens> {
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString("base64")

  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI ?? "",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO token exchange failed: ${text}`)
  }

  const json = await res.json()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiry: new Date(Date.now() + json.expires_in * 1000),
  }
}

/**
 * Refresh an expired QBO access token.
 */
export async function refreshQBOTokens(refreshToken: string): Promise<OAuthTokens> {
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString("base64")

  const res = await fetch(QBO_TOKEN_URL, {
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
    throw new Error(`QBO token refresh failed: ${text}`)
  }

  const json = await res.json()
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiry: new Date(Date.now() + json.expires_in * 1000),
  }
}

// ---------------------------------------------------------------------------
// State encoding helpers — simple base64 encoding of JSON payload
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
