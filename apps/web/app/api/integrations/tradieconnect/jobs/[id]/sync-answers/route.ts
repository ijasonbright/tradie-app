import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { decryptFromStorage } from '@/lib/tradieconnect'
import {
  fetchTCFormDefinition,
  buildTCSyncPayload,
  syncAnswersToTC,
} from '@/lib/tradieconnect/form-api'
import { SyncAnswersRequest } from '@/lib/tradieconnect/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/tradieconnect/jobs/:tcJobId/sync-answers
 *
 * Syncs form answers to TradieConnect.
 * This is called when the user saves a page or completes the form.
 *
 * This is part of the parallel testing system for dynamic TC form sync.
 * The existing template-based system remains unchanged.
 *
 * Authentication: Clerk (web) + JWT (mobile)
 *
 * Request body:
 * {
 *   answers: {
 *     "tc_q_2474": "Yes",
 *     "tc_q_2475": "Some text answer",
 *     ...
 *   },
 *   photo_urls: {
 *     "tc_q_1234": ["https://blob.url/photo1.jpg", "https://blob.url/photo2.jpg"]
 *   },
 *   group_no: 134,      // Optional: sync only this group/page
 *   is_complete: false  // If true, will set shouldCompleteJob and shouldCreatePdf
 * }
 *
 * Response:
 * {
 *   success: true,
 *   tc_response: { ... },
 *   synced_answers: 5,
 *   is_complete: false
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tcJobId } = await params
    const body: SyncAnswersRequest = await request.json()
    const { answers, photo_urls, group_no, is_complete } = body

    const sql = neon(process.env.DATABASE_URL!)

    // Validate request
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request', message: 'answers object is required' },
        { status: 400 }
      )
    }

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

    // Get user with TC credentials
    const users = await sql`
      SELECT
        u.id,
        u.tc_user_id,
        u.tc_token,
        u.tc_refresh_token,
        u.tc_provider_id,
        om.organization_id
      FROM users u
      JOIN organization_members om ON u.id = om.user_id
      WHERE u.clerk_user_id = ${clerkUserId}
      LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Check if user has TC credentials
    if (!user.tc_user_id || !user.tc_token) {
      return NextResponse.json(
        { error: 'TradieConnect not connected', message: 'Please connect your TradieConnect account first' },
        { status: 400 }
      )
    }

    // Check if user has TC provider ID (needed for posting answers)
    if (!user.tc_provider_id) {
      return NextResponse.json(
        { error: 'TradieConnect provider ID not found', message: 'Please reconnect your TradieConnect account' },
        { status: 400 }
      )
    }

    // Decrypt TC token
    let tcToken: string
    try {
      tcToken = decryptFromStorage(user.tc_token)
    } catch (error) {
      console.error('Failed to decrypt TC token:', error)
      return NextResponse.json(
        { error: 'TradieConnect authentication error', message: 'Please reconnect your TradieConnect account' },
        { status: 400 }
      )
    }

    // First, fetch the form definition from TC (needed to build the payload correctly)
    const formResult = await fetchTCFormDefinition(
      tcJobId,
      user.tc_user_id,
      tcToken
    )

    if (!formResult.success || !formResult.form) {
      if (formResult.unauthorized) {
        return NextResponse.json(
          { error: 'TradieConnect session expired', message: 'Please reconnect your TradieConnect account' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch form definition', details: formResult.error },
        { status: 500 }
      )
    }

    // Build the sync payload
    const payload = buildTCSyncPayload({
      tcJobId: parseInt(tcJobId),
      tcFormDefinition: formResult.form,
      answers,
      photoUrls: photo_urls,
      groupNo: group_no,
      userId: user.tc_provider_id,
      providerId: user.tc_provider_id,
      isComplete: is_complete,
    })

    console.log('Built TC sync payload:', {
      jobId: payload.jobId,
      questionCount: payload.jobTypeForm.questions.length,
      answerCount: payload.jobTypeForm.jobAnswers.length,
      isComplete: is_complete,
      groupNo: group_no,
    })

    // Sync to TC
    const syncResult = await syncAnswersToTC(
      payload,
      user.tc_user_id,
      tcToken
    )

    if (!syncResult.success) {
      if (syncResult.unauthorized) {
        return NextResponse.json(
          { error: 'TradieConnect session expired', message: 'Please reconnect your TradieConnect account' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to sync answers to TradieConnect',
          details: syncResult.error,
        },
        { status: 500 }
      )
    }

    // Success!
    return NextResponse.json({
      success: true,
      tc_response: syncResult.response,
      synced_answers: payload.jobTypeForm.jobAnswers.length,
      is_complete,
      group_no: group_no || null,
      _debug: {
        tc_job_id: tcJobId,
        tc_form_id: formResult.form.jobTypeFormId,
        tc_provider_id: user.tc_provider_id,
        synced_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error syncing answers to TC:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync answers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
