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
 */
export async function refreshToken(tcUserId: string, tcRefreshToken: string): Promise<{
  success: boolean
  token?: string
  refreshToken?: string
  error?: string
}> {
  try {
    const response = await tradieConnectApiRequest(
      '/api/v2/Auth/refresh',
      tcUserId,
      tcRefreshToken,
      { method: 'POST' }
    )

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        token: data.token,
        refreshToken: data.refreshToken,
      }
    }

    return { success: false, error: `Token refresh failed: ${response.status}` }
  } catch (error) {
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

    return { success: false, error: `Failed to fetch job: ${response.status}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Gets the TradieConnect auth URL for SSO
 */
export function getAuthUrl(): string {
  return TRADIECONNECT_AUTH_URL
}

/**
 * Gets the TradieConnect API base URL
 */
export function getApiUrl(): string {
  return TRADIECONNECT_API_URL
}
