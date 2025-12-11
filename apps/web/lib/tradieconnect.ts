import crypto from 'crypto'

// Environment variables
const TRADIECONNECT_API_URL = process.env.TRADIECONNECT_API_URL || 'https://admin.taskforce.com.au'
const TRADIECONNECT_AUTH_URL = process.env.TRADIECONNECT_AUTH_URL || 'https://auth.taskforce.com.au'
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
 * Fetches a job from TradieConnect by ID (basic version)
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
 * Fetches full job details from TradieConnect by ID
 * Returns typed TCJobDetails with property, pricing, history, etc.
 */
export async function fetchTCJobDetails(
  jobId: number | string,
  tcUserId: string,
  tcToken: string,
  pid: number = 0
): Promise<{
  success: boolean
  job?: TCJobDetails
  error?: string
  unauthorized?: boolean
}> {
  try {
    const response = await tradieConnectApiRequest(
      `/api/v2/Job/${jobId}?pid=${pid}`,
      tcUserId,
      tcToken,
      { method: 'GET' }
    )

    if (response.ok) {
      const rawJob = await response.json()

      // Map the response to our typed interface
      const job: TCJobDetails = {
        jobId: rawJob.property?.jobId || parseInt(String(jobId)),
        code: rawJob.code || '',
        calendarLink: rawJob.calendarLink || '',

        lat: rawJob.lat || rawJob.latLong?.lat || 0,
        long: rawJob.long || rawJob.lng || rawJob.latLong?.long || 0,
        addressState: rawJob.addressState,
        addressLocality: rawJob.addressLocality,
        addressPostcode: rawJob.addressPostcode,
        addressCountry: rawJob.addressCountry,
        entryNotes: rawJob.entryNotes,

        jobSourcePrettyPrint: rawJob.jobSourcePrettyPrint || '',
        propertyMeStatus: rawJob.propertyMeStatus || '',
        propertyMeSummary: rawJob.propertyMeSummary || '',
        isInspection: rawJob.isInspection || false,
        isEnergyUpgrade: rawJob.isEnergyUpgrade || false,
        isRectification: rawJob.isRectification || false,
        hasGas: rawJob.hasGas || false,

        phone: rawJob.phone,
        jobContactEmail: rawJob.jobContactEmail,
        jobContactFirstName: rawJob.jobContactFirstName,
        jobContactLastName: rawJob.jobContactLastName,
        jobContactMobile: rawJob.jobContactMobile,

        pricing: rawJob.pricing ? {
          lotJobTypeSubscriptionId: rawJob.pricing.lotJobTypeSubscriptionId || 0,
          jobTypeId: rawJob.pricing.jobTypeId || 0,
          lotSubscriptionTypeId: rawJob.pricing.lotSubscriptionTypeId || 0,
          propertyType: rawJob.pricing.propertyType || '',
          yearly: rawJob.pricing.yearly || 0,
          initial: rawJob.pricing.initial || 0,
          currentJobCost: rawJob.pricing.currentJobCost || 0,
          jobTypeName: rawJob.pricing.jobTypeName || '',
          initialWithGst: rawJob.pricing.initialWithGst || 0,
        } : null,

        questions: rawJob.questions || [],
        files: rawJob.files || [],
        history: (rawJob.history || []).map((h: any) => ({
          id: h.id,
          jobId: h.jobId,
          description: h.description,
          timestamp: h.timestamp,
          statusId: h.statusId,
          statusName: h.statusName,
          fullname: h.fullname,
          firstname: h.firstname,
          lastname: h.lastname,
          mobile: h.mobile,
        })),

        property: rawJob.property ? {
          id: rawJob.property.id || 0,
          address: rawJob.property.address,
          unit: rawJob.property.unit,
          number: rawJob.property.number,
          street: rawJob.property.street,
          suburb: rawJob.property.suburb,
          state: rawJob.property.state,
          postCode: rawJob.property.postCode,
          lat: rawJob.property.lat || 0,
          long: rawJob.property.long || 0,
          tenantName: rawJob.property.tenantName,
          tenantEmail: rawJob.property.tenantEmail,
          tenantMobile: rawJob.property.tenantMobile,
          tenantFirstname: rawJob.property.tenantFirstname,
          tenantLastname: rawJob.property.tenantLastname,
          tenantFullname: rawJob.property.tenantFullname || '',
          ownerName: rawJob.property.ownerName,
          ownerEmail: rawJob.property.ownerEmail,
          ownerMobile: rawJob.property.ownerMobile,
          ownerFirstname: rawJob.property.ownerFirstname,
          ownerLastname: rawJob.property.ownerLastname,
          ownerFullname: rawJob.property.ownerFullname || '',
          managerName: rawJob.property.managerName,
          managerEmail: rawJob.property.managerEmail,
          managerMobile: rawJob.property.managerMobile,
          managerFirstname: rawJob.property.managerFirstname,
          managerLastname: rawJob.property.managerLastname,
          managerFullname: rawJob.property.managerFullname || '',
          jobTypeName: rawJob.property.jobTypeName || rawJob.pricing?.jobTypeName,
          jobStatusName: rawJob.property.jobStatusName || rawJob.propertyMeStatus || 'Unknown',
          scheduledDate: rawJob.property.scheduledDate,
          description: rawJob.property.description,
          siteAccessNotes: rawJob.property.siteAccessNotes,
        } : null,
      }

      return { success: true, job }
    }

    // Check for 401 - token expired
    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    const errorText = await response.text()
    return { success: false, error: `Failed to fetch job details: ${response.status} - ${errorText}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * TradieConnect User details returned from the User API
 */
export interface TCUser {
  userId: number
  providerId: number
  firstName: string
  lastName: string
  email: string
  mobile: string
  jobTypeId: number
  jobType: string
  // There may be more fields, but these are the key ones we need
}

/**
 * Fetches the current user's details from TradieConnect
 * This returns the providerId which is needed for matching jobs
 *
 * @param tcUserId - The TradieConnect user GUID (from SSO callback)
 * @param tcToken - The access token
 */
export async function fetchTCUser(
  tcUserId: string,
  tcToken: string
): Promise<{
  success: boolean
  user?: TCUser
  error?: string
  unauthorized?: boolean
}> {
  try {
    const response = await tradieConnectApiRequest(
      `/api/v2/User/${tcUserId}`,
      tcUserId,
      tcToken,
      { method: 'GET' }
    )

    if (response.ok) {
      const user = await response.json()
      return { success: true, user }
    }

    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    const errorText = await response.text()
    return { success: false, error: `Failed to fetch user: ${response.status} - ${errorText}` }
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

// ==================== Provider/Team Types ====================

export interface TCProvider {
  providerId: number
  userId: number
  jobTypeId: number
  firstName: string
  lastName: string
  email: string
  mobile: string
  name: string
}

export interface TCJob {
  jobId: number
  teamId: number
  userId: number
  statusId: number
  firstName: string
  lastName: string
  mobile: string
  email: string
  jobType: string
  jobTypeConfig: string | null
  address: string
  start: string
  duration: number
  spacing: number
  title: string
  description: string
  statusName: string
  lat: number
  long: number
}

// ==================== Job Details Types ====================

export interface TCJobHistoryItem {
  id: number
  jobId: number
  description: string
  timestamp: string
  statusId: number
  statusName: string
  fullname: string
  firstname: string | null
  lastname: string | null
  mobile: string | null
}

export interface TCJobPricing {
  lotJobTypeSubscriptionId: number
  jobTypeId: number
  lotSubscriptionTypeId: number
  propertyType: string
  yearly: number
  initial: number
  currentJobCost: number
  jobTypeName: string
  initialWithGst: number
}

export interface TCJobFile {
  id: number
  jobId: number
  filename: string
  url: string
  uploadedAt: string
}

export interface TCJobDetails {
  // Core job info
  jobId: number
  code: string
  calendarLink: string

  // Property/location
  lat: number
  long: number
  addressState: string | null
  addressLocality: string | null
  addressPostcode: string | null
  addressCountry: string | null
  entryNotes: string | null

  // Job type and status
  jobSourcePrettyPrint: string
  propertyMeStatus: string
  propertyMeSummary: string
  isInspection: boolean
  isEnergyUpgrade: boolean
  isRectification: boolean
  hasGas: boolean

  // Contact info
  phone: string | null
  jobContactEmail: string | null
  jobContactFirstName: string | null
  jobContactLastName: string | null
  jobContactMobile: string | null

  // Pricing
  pricing: TCJobPricing | null

  // Related data
  questions: any[]
  files: TCJobFile[]
  history: TCJobHistoryItem[]

  // Property details (nested object with tenant/owner/manager info)
  property: {
    id: number
    address: string | null
    unit: string | null
    number: string | null
    street: string | null
    suburb: string | null
    state: string | null
    postCode: string | null
    lat: number
    long: number
    tenantName: string | null
    tenantEmail: string | null
    tenantMobile: string | null
    tenantFirstname: string | null
    tenantLastname: string | null
    tenantFullname: string
    ownerName: string | null
    ownerEmail: string | null
    ownerMobile: string | null
    ownerFirstname: string | null
    ownerLastname: string | null
    ownerFullname: string
    managerName: string | null
    managerEmail: string | null
    managerMobile: string | null
    managerFirstname: string | null
    managerLastname: string | null
    managerFullname: string
    jobTypeName: string | null
    jobStatusName: string
    scheduledDate: string | null
    description: string | null
    siteAccessNotes: string | null
  } | null
}

export interface TCSchedule {
  jobDate: string
  providers: TCProvider[]
  jobs: TCJob[]
}

export interface TCTeam {
  teamId: number
  userId: number
  name: string
  schedules: TCSchedule[]
}

/**
 * Fetches the provider calendar (teams and their assigned tradies/jobs) from TradieConnect
 * @param date - The date to fetch the calendar for (YYYY-MM-DD format)
 * @param teamId - The team ID to filter by (0 = all teams)
 * @param offset - Pagination offset (default 0)
 */
export async function fetchProviderCalendar(
  tcUserId: string,
  tcToken: string,
  date: string,
  teamId: number = 0,
  offset: number = 0
): Promise<{
  success: boolean
  teams?: TCTeam[]
  error?: string
  unauthorized?: boolean
}> {
  try {
    const endpoint = `/api/v2/ProviderCalendar?date=${encodeURIComponent(date)}&teamId=${teamId}&offset=${offset}`

    const response = await tradieConnectApiRequest(
      endpoint,
      tcUserId,
      tcToken,
      { method: 'GET' }
    )

    if (response.ok) {
      const teams = await response.json()
      return { success: true, teams }
    }

    if (response.status === 401) {
      return { success: false, error: 'Token expired', unauthorized: true }
    }

    const errorText = await response.text()
    return { success: false, error: `Failed to fetch provider calendar: ${response.status} - ${errorText}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Fetches all jobs for a specific date from the provider calendar
 */
export async function fetchJobsForDate(
  tcUserId: string,
  tcToken: string,
  date: string
): Promise<{
  success: boolean
  jobs?: TCJob[]
  teams?: { teamId: number; teamName: string }[]
  error?: string
  unauthorized?: boolean
}> {
  const result = await fetchProviderCalendar(tcUserId, tcToken, date, 0, 0)

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      unauthorized: result.unauthorized,
    }
  }

  // Flatten jobs from all teams
  const allJobs: TCJob[] = []
  const teams: { teamId: number; teamName: string }[] = []

  for (const team of result.teams || []) {
    teams.push({ teamId: team.teamId, teamName: team.name })

    for (const schedule of team.schedules) {
      allJobs.push(...schedule.jobs)
    }
  }

  return { success: true, jobs: allJobs, teams }
}

/**
 * Fetches all providers/tradies from the provider calendar
 */
export async function fetchProviders(
  tcUserId: string,
  tcToken: string,
  date: string
): Promise<{
  success: boolean
  providers?: TCProvider[]
  error?: string
  unauthorized?: boolean
}> {
  const result = await fetchProviderCalendar(tcUserId, tcToken, date, 0, 0)

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      unauthorized: result.unauthorized,
    }
  }

  // Flatten providers from all teams and dedupe by providerId
  const providerMap = new Map<number, TCProvider>()

  for (const team of result.teams || []) {
    for (const schedule of team.schedules) {
      for (const provider of schedule.providers) {
        if (!providerMap.has(provider.providerId)) {
          providerMap.set(provider.providerId, provider)
        }
      }
    }
  }

  return { success: true, providers: Array.from(providerMap.values()) }
}
