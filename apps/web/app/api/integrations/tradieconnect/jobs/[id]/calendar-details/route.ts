import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { tradieConnectApiRequest, refreshToken } from '@/lib/tradieconnect'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Calendar-specific job details from TradieConnect
 * These are the fields needed for displaying jobs in the calendar view
 */
export interface TCCalendarJobDetails {
  // Contact person
  firstname: string | null
  lastname: string | null
  mobile: string | null
  email: string | null

  // Job type information
  tfname: string | null // Job type name
  additionaljobtype: string | null // Additional job type (should be highlighted if present)

  // Status
  statusName: string | null
  statusId: number | null

  // Address
  address1: string | null
  address2: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  fullAddress: string | null

  // Location for navigation
  lat: number | null
  long: number | null

  // Date/time
  start: string | null
  scheduledDate: string | null
  prettyPrintDate: string | null

  // Other useful info
  jobId: number
  description: string | null
  entryNotes: string | null
}

/**
 * GET /api/integrations/tradieconnect/jobs/:tcJobId/calendar-details
 *
 * Fetches job details from TradieConnect API that are specifically
 * needed for displaying enhanced calendar information:
 * - Contact person name (firstname, lastname)
 * - Job type (tfname)
 * - Additional job type (additionaljobtype)
 * - Status name
 * - Address1
 * - Mobile for call button
 * - Lat/Long for navigation button
 *
 * Authentication: Clerk (web) + JWT (mobile)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tcJobId } = await params
    const sql = neon(process.env.DATABASE_URL!)

    // Dual auth: Clerk (web) + JWT (mobile)
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT
    }

    if (!clerkUserId) {
      const authHeader = request.headers.get('authorization')
      const token = extractTokenFromHeader(authHeader)
      if (token) {
        const payload = await verifyMobileToken(token)
        if (payload) {
          clerkUserId = payload.clerkUserId
        }
      }
    }

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get active TradieConnect connection
    const connections = await sql`
      SELECT
        id,
        tc_user_id,
        tc_token,
        tc_refresh_token
      FROM tradieconnect_connections
      WHERE user_id = ${user.id}
      AND is_active = true
      LIMIT 1
    `

    if (connections.length === 0) {
      return NextResponse.json(
        { error: 'TradieConnect not connected', needs_connect: true },
        { status: 400 }
      )
    }

    const connection = connections[0]
    let tcToken = connection.tc_token
    const tcRefreshToken = connection.tc_refresh_token

    // Fetch job details from TC - GET /api/v2/Job/{jobId}?pid=0
    let response = await tradieConnectApiRequest(
      `/api/v2/Job/${tcJobId}?pid=0`,
      connection.tc_user_id,
      tcToken,
      { method: 'GET' }
    )

    // If token expired and we have a refresh token, try to refresh
    if (response.status === 401 && tcRefreshToken) {
      console.log('TC token expired, attempting refresh for calendar-details...')

      const refreshResult = await refreshToken(connection.tc_user_id, tcRefreshToken)

      if (refreshResult.success && refreshResult.token) {
        // Update tokens in database
        await sql`
          UPDATE tradieconnect_connections
          SET
            tc_token = ${refreshResult.token},
            tc_refresh_token = ${refreshResult.refreshToken || null},
            updated_at = NOW()
          WHERE id = ${connection.id}
        `

        // Retry with new token
        tcToken = refreshResult.token
        response = await tradieConnectApiRequest(
          `/api/v2/Job/${tcJobId}?pid=0`,
          connection.tc_user_id,
          tcToken,
          { method: 'GET' }
        )
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'TradieConnect session expired', needs_reconnect: true },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch job details from TradieConnect' },
        { status: 500 }
      )
    }

    const rawJob = await response.json()

    // Format pretty print date from scheduledDate or start time
    let prettyPrintDate: string | null = null
    const dateSource = rawJob.scheduledDate || rawJob.start || rawJob.property?.scheduledDate
    if (dateSource) {
      try {
        const date = new Date(dateSource)
        prettyPrintDate = date.toLocaleDateString('en-AU', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Build full address from components
    const addressParts = [
      rawJob.address1 || rawJob.Address1 || rawJob.property?.address,
      rawJob.address2 || rawJob.Address2,
      rawJob.suburb || rawJob.Suburb || rawJob.property?.suburb,
      rawJob.state || rawJob.State || rawJob.property?.state,
      rawJob.postcode || rawJob.PostCode || rawJob.property?.postCode,
    ].filter(Boolean)
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null

    // Extract the fields needed for calendar display
    // TC API may use different casing, so we check multiple variations
    const calendarDetails: TCCalendarJobDetails = {
      // Contact person - check multiple possible field names
      firstname: rawJob.firstname || rawJob.firstName || rawJob.FirstName ||
                 rawJob.property?.tenantFirstname || rawJob.jobContactFirstName || null,
      lastname: rawJob.lastname || rawJob.lastName || rawJob.LastName ||
                rawJob.property?.tenantLastname || rawJob.jobContactLastName || null,
      mobile: rawJob.mobile || rawJob.Mobile || rawJob.phone || rawJob.Phone ||
              rawJob.property?.tenantMobile || rawJob.jobContactMobile || null,
      email: rawJob.email || rawJob.Email || rawJob.jobContactEmail ||
             rawJob.property?.tenantEmail || null,

      // Job type
      tfname: rawJob.tfname || rawJob.tfName || rawJob.TfName ||
              rawJob.jobTypeName || rawJob.pricing?.jobTypeName ||
              rawJob.property?.jobTypeName || null,
      additionaljobtype: rawJob.additionaljobtype || rawJob.additionalJobType ||
                         rawJob.AdditionalJobType || rawJob.additionalJobTypeName || null,

      // Status
      statusName: rawJob.statusName || rawJob.StatusName ||
                  rawJob.property?.statusName || rawJob.propertyMeStatus || null,
      statusId: rawJob.statusId || rawJob.StatusId || rawJob.property?.statusId || null,

      // Address
      address1: rawJob.address1 || rawJob.Address1 || rawJob.property?.address || null,
      address2: rawJob.address2 || rawJob.Address2 || null,
      suburb: rawJob.suburb || rawJob.Suburb || rawJob.property?.suburb || null,
      state: rawJob.state || rawJob.State || rawJob.property?.state || null,
      postcode: rawJob.postcode || rawJob.PostCode || rawJob.property?.postCode || null,
      fullAddress,

      // Location for navigation
      lat: rawJob.lat || rawJob.Lat || rawJob.property?.lat || null,
      long: rawJob.long || rawJob.Long || rawJob.lng || rawJob.property?.long || null,

      // Date/time
      start: rawJob.start || rawJob.Start || null,
      scheduledDate: rawJob.scheduledDate || rawJob.ScheduledDate ||
                     rawJob.property?.scheduledDate || null,
      prettyPrintDate,

      // Other info
      jobId: parseInt(tcJobId),
      description: rawJob.description || rawJob.Description ||
                   rawJob.property?.description || null,
      entryNotes: rawJob.entryNotes || rawJob.EntryNotes ||
                  rawJob.property?.siteAccessNotes || null,
    }

    return NextResponse.json({
      success: true,
      job: calendarDetails,
    })
  } catch (error) {
    console.error('Error getting TC calendar job details:', error)
    return NextResponse.json(
      {
        error: 'Failed to get job details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
