import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

/**
 * POST /api/integrations/tradieconnect/jobs/:tcJobId/photos
 *
 * Upload photo for TC Live Form - stores in Vercel Blob and returns URL.
 * This is separate from completion-form/photos which requires a database form record.
 *
 * The photo URL is returned immediately for display and later sync to TC.
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
    const file = formData.get('file') as File | null
    const questionKey = formData.get('question_key') as string | null // e.g., "tc_q_2279"

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Upload to Vercel Blob - use tc-live-form path
    const timestamp = Date.now()
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `tc-live-form/${organizationId}/${tcJobId}/${questionKey || 'general'}/${timestamp}-${safeFilename}`

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    console.log('TC Live Form photo uploaded:', {
      tcJobId,
      questionKey,
      url: blob.url,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
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
