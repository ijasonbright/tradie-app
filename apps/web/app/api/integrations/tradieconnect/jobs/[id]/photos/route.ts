import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

/**
 * POST /api/integrations/tradieconnect/jobs/:tcJobId/photos
 *
 * Upload photo for TC Live Form - stores in Vercel Blob and returns URLs.
 *
 * Accepts TWO versions of the photo:
 * - 'display_file': Normal orientation for display in our app
 * - 'tc_file': Counter-rotated (-90°) to compensate for TC's hardcoded +90° rotation
 *
 * Returns both URLs so the mobile app can:
 * - Display the 'display_url' in the app UI
 * - Send the 'tc_url' when syncing to TradieConnect
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Dual authentication: Clerk (web) + JWT (mobile)
  let clerkUserId: string | null = null

  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch (error) {
    // Clerk auth failed, try JWT token
  }

  // If no Clerk auth, try mobile JWT token
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

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { id: tcJobId } = await params

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id, u.id as user_id
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (userOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = userOrgs[0].organization_id

    // Parse multipart form data
    const formData = await request.formData()
    const displayFile = formData.get('display_file') as File | null
    const tcFile = formData.get('tc_file') as File | null
    const legacyFile = formData.get('file') as File | null // Backward compatibility
    const questionKey = formData.get('question_key') as string | null // e.g., "tc_q_2279"

    // Handle backward compatibility - if only 'file' is provided, use it for both
    const fileToDisplay = displayFile || legacyFile
    const fileToTC = tcFile || legacyFile

    if (!fileToDisplay && !fileToTC) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (fileToDisplay && !fileToDisplay.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Display file must be an image' }, { status: 400 })
    }
    if (fileToTC && !fileToTC.type.startsWith('image/')) {
      return NextResponse.json({ error: 'TC file must be an image' }, { status: 400 })
    }

    const timestamp = Date.now()
    let displayUrl: string | null = null
    let tcUrl: string | null = null

    // Upload display version (for our app)
    if (fileToDisplay) {
      const safeFilename = fileToDisplay.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const displayFilename = `tc-live-form/${organizationId}/${tcJobId}/${questionKey || 'general'}/display-${timestamp}-${safeFilename}`

      const displayBlob = await put(displayFilename, fileToDisplay, {
        access: 'public',
        addRandomSuffix: false,
      })
      displayUrl = displayBlob.url
    }

    // Upload TC version (counter-rotated for TradieConnect)
    if (fileToTC) {
      const safeFilename = fileToTC.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const tcFilename = `tc-live-form/${organizationId}/${tcJobId}/${questionKey || 'general'}/tc-${timestamp}-${safeFilename}`

      const tcBlob = await put(tcFilename, fileToTC, {
        access: 'public',
        addRandomSuffix: false,
      })
      tcUrl = tcBlob.url
    }

    console.log('TC Live Form photos uploaded:', {
      tcJobId,
      questionKey,
      displayUrl,
      tcUrl,
    })

    return NextResponse.json({
      success: true,
      url: tcUrl || displayUrl, // For backward compatibility, 'url' is the TC version
      display_url: displayUrl || tcUrl, // For display in our app
      tc_url: tcUrl || displayUrl, // For syncing to TradieConnect
      question_key: questionKey,
      message: 'Photo uploaded successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Error uploading TC Live Form photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
