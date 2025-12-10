import crypto from 'crypto'

// Environment variables
const TRADIECONNECT_API_URL = process.env.TRADIECONNECT_API_URL || 'https://testadmin.taskforce.com.au'
const TRADIECONNECT_AUTH_URL = process.env.TRADIECONNECT_AUTH_URL || 'https://testauth.taskforce.com.au'
const TRADIECONNECT_ENCRYPT_KEY = process.env.TRADIECONNECT_ENCRYPT_KEY || ''

/**
 * Decrypts a URL parameter from TradieConnect SSO callback
 * Uses AES-256-CBC with zero IV and URL-safe Base64 encoding
 *
 * URL-safe encoding: "||||" → "+", "____" → "/"
 */
export function decryptUrlParameter(cipherText: string): string {
  if (!TRADIECONNECT_ENCRYPT_KEY) {
    throw new Error('TRADIECONNECT_ENCRYPT_KEY is not configured')
  }

  // Convert URL-safe Base64 to standard Base64
  let base64 = cipherText
    .replace(/\|\|\|\|/g, '+')
    .replace(/____/g, '/')

  // Add padding based on length
  switch (base64.length % 4) {
    case 2:
      base64 += '=='
      break
    case 3:
      base64 += '='
      break
  }

  // AES decrypt with zero IV
  const iv = Buffer.alloc(16, 0)
  const keyBuffer = Buffer.from(TRADIECONNECT_ENCRYPT_KEY, 'utf8')

  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
  let decrypted = decipher.update(base64, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Encrypts data for storage in database
 * Uses AES-256-CBC with random IV
 */
export function encryptForStorage(plainText: string): string {
  if (!TRADIECONNECT_ENCRYPT_KEY) {
    throw new Error('TRADIECONNECT_ENCRYPT_KEY is not configured')
  }

  const iv = crypto.randomBytes(16)
  const keyBuffer = Buffer.from(TRADIECONNECT_ENCRYPT_KEY, 'utf8')

  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Prepend IV to encrypted data (IV is not secret)
  return iv.toString('base64') + ':' + encrypted
}

/**
 * Decrypts data from database storage
 */
export function decryptFromStorage(encryptedData: string): string {
  if (!TRADIECONNECT_ENCRYPT_KEY) {
    throw new Error('TRADIECONNECT_ENCRYPT_KEY is not configured')
  }

  const [ivBase64, encrypted] = encryptedData.split(':')
  const iv = Buffer.from(ivBase64, 'base64')
  const keyBuffer = Buffer.from(TRADIECONNECT_ENCRYPT_KEY, 'utf8')

  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Creates Basic Auth header for TradieConnect API calls
 */
export function createBasicAuthHeader(tcUserId: string, tcToken: string): string {
  const credentials = Buffer.from(`${tcUserId}:${tcToken}`).toString('base64')
  return `Basic ${credentials}`
}

/**
 * Makes an authenticated request to TradieConnect API
 */
export async function tradieConnectApiRequest(
  endpoint: string,
  tcUserId: string,
  tcToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${TRADIECONNECT_API_URL}${endpoint}`
  const authHeader = createBasicAuthHeader(tcUserId, tcToken)

  return fetch(url, {
    ...options,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

/**
 * Validates a TradieConnect token
 */
export async function validateToken(tcUserId: string, tcToken: string): Promise<{
  valid: boolean
  error?: string
}> {
  try {
    // Call the validate endpoint
    const response = await tradieConnectApiRequest(
      '/api/v2/Auth/validate',
      tcUserId,
      tcToken,
      { method: 'GET' }
    )

    if (response.ok) {
      return { valid: true }
    }

    return { valid: false, error: `Token validation failed: ${response.status}` }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Refreshes a TradieConnect token using the refresh token
 * Note: The refresh token is passed as the "token" in Basic Auth, and can only be used once.
 * The new token details must be stored by the calling app.
 */
export async function refreshToken(tcUserId: string, tcRefreshToken: string): Promise<{
  success: boolean
  token?: string
  refreshToken?: string
  userGuId?: string
  expiry?: string
  error?: string
}> {
  try {
    // Build the refresh URL with query parameters
    // Format: /api/v2/Auth/?param1=refresh&id={userid}&token={tc_refresh_token}
    const refreshUrl = `${TRADIECONNECT_API_URL}/api/v2/Auth/?param1=refresh&id=${encodeURIComponent(tcUserId)}&token=${encodeURIComponent(tcRefreshToken)}`

    console.log('Calling TradieConnect refresh API...')
    console.log('User ID:', tcUserId)
    console.log('Refresh URL (without token):', `${TRADIECONNECT_API_URL}/api/v2/Auth/?param1=refresh&id=${tcUserId}&token=...`)

    const response = await fetch(refreshUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('TradieConnect refresh response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Refresh response data keys:', Object.keys(data))
      // Response format: { token, refreshToken, userGuId, expiry, ... }
      return {
        success: true,
        token: data.token || data.Token,
        refreshToken: data.refreshToken || data.RefreshToken,
        userGuId: data.userGuId || data.UserGuId,
        expiry: data.expiry || data.Expiry,
      }
    }

    const errorText = await response.text()
    console.log('TradieConnect refresh error response:', errorText)
    return { success: false, error: `Token refresh failed: ${response.status} - ${errorText}` }
  } catch (error) {
    console.error('TradieConnect refresh exception:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Fetches a job from TradieConnect by ID
 */
export async function fetchJob(
  jobId: string,
  tcUserId: string,
  tcToken: string
): Promise<{
  success: boolean
  job?: any
  error?: string
  unauthorized?: boolean
}> {
  try {
    const response = await tradieConnectApiRequest(
      `/api/v2/Job/${jobId}`,
      tcUserId,
      tcToken,
      { method: 'GET' }
    )

    if (response.ok) {
      const job = await response.json()
      return { success: true, job }
    }

    // Check for 401 - token expired
    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    return { success: false, error: `Failed to fetch job: ${response.status}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Makes an authenticated API call with automatic token refresh on 401
 * This is a higher-level function that handles the refresh flow
 */
export async function tradieConnectApiWithRefresh(params: {
  endpoint: string
  tcUserId: string
  tcToken: string
  tcRefreshToken: string | null
  method?: string
  body?: any
  onTokenRefreshed?: (newToken: string, newRefreshToken: string | null) => Promise<void>
}): Promise<{
  success: boolean
  data?: any
  error?: string
  needsReconnect?: boolean
}> {
  const { endpoint, tcUserId, tcToken, tcRefreshToken, method = 'GET', body, onTokenRefreshed } = params

  try {
    // First attempt with current token
    const response = await tradieConnectApiRequest(
      endpoint,
      tcUserId,
      tcToken,
      {
        method,
        body: body ? JSON.stringify(body) : undefined,
      }
    )

    if (response.ok) {
      const data = await response.json()
      return { success: true, data }
    }

    // If 401 and we have a refresh token, try to refresh
    if (response.status === 401 && tcRefreshToken) {
      console.log('TradieConnect token expired, attempting refresh...')

      const refreshResult = await refreshToken(tcUserId, tcRefreshToken)

      if (refreshResult.success && refreshResult.token) {
        // Notify caller of new tokens so they can be stored
        if (onTokenRefreshed) {
          await onTokenRefreshed(refreshResult.token, refreshResult.refreshToken || null)
        }

        // Retry the request with new token
        const retryResponse = await tradieConnectApiRequest(
          endpoint,
          tcUserId,
          refreshResult.token,
          {
            method,
            body: body ? JSON.stringify(body) : undefined,
          }
        )

        if (retryResponse.ok) {
          const data = await retryResponse.json()
          return { success: true, data }
        }

        return {
          success: false,
          error: `API call failed after token refresh: ${retryResponse.status}`,
        }
      }

      // Refresh failed
      return {
        success: false,
        error: 'Token expired and refresh failed',
        needsReconnect: true,
      }
    }

    // Not a 401 or no refresh token
    if (response.status === 401) {
      return {
        success: false,
        error: 'Token expired',
        needsReconnect: true,
      }
    }

    return {
      success: false,
      error: `API call failed: ${response.status}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Encrypts a string for TradieConnect URL parameter
 * Uses AES-256-CBC with zero IV and URL-safe Base64 encoding
 */
export function encryptUrlParameter(plainText: string): string {
  if (!TRADIECONNECT_ENCRYPT_KEY) {
    throw new Error('TRADIECONNECT_ENCRYPT_KEY is not configured')
  }

  // AES encrypt with zero IV
  const iv = Buffer.alloc(16, 0)
  const keyBuffer = Buffer.from(TRADIECONNECT_ENCRYPT_KEY, 'utf8')

  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Convert standard Base64 to URL-safe format
  // Remove padding and convert: "+" → "||||", "/" → "____"
  let urlSafe = encrypted
    .replace(/=+$/, '') // Remove padding
    .replace(/\+/g, '||||')
    .replace(/\//g, '____')

  return urlSafe
}

/**
 * Gets the TradieConnect auth URL for SSO with encrypted referer parameter
 * @param refererUrl - The URL to redirect back to after SSO (e.g., '/dashboard/integrations')
 */
export function getAuthUrl(refererUrl?: string): string {
  // Default referer if not provided
  const referer = refererUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://tradie-app-web.vercel.app'}/dashboard/integrations`

  // Encrypt the referer URL
  const encryptedReferer = encryptUrlParameter(referer)

  return `${TRADIECONNECT_AUTH_URL}/?r=${encryptedReferer}`
}

/**
 * Gets the TradieConnect API base URL
 */
export function getApiUrl(): string {
  return TRADIECONNECT_API_URL
}
