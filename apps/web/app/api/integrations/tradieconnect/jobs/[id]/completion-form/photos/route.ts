import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

/**
 * POST /api/integrations/tradieconnect/jobs/:tcJobId/completion-form/photos
 *
 * Upload photo to TC job completion form
 * Stores in Vercel Blob and creates record in job_completion_form_photos
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
    const userId = userOrgs[0].user_id

    // Get completion form for this TC job
    const forms = await sql`
      SELECT id FROM job_completion_forms
      WHERE organization_id = ${organizationId}
      AND form_data->>'tc_job_id' = ${tcJobId}
      LIMIT 1
    `

    if (forms.length === 0) {
      return NextResponse.json({ error: 'Completion form not found. Create form first.' }, { status: 404 })
    }

    const formId = forms[0].id

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const questionId = formData.get('question_id') as string | null
    const caption = formData.get('caption') as string | null
    const photoType = (formData.get('photo_type') as string) || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Upload to Vercel Blob - use tc-jobs path for TC job photos
    const timestamp = Date.now()
    const filename = `completion-forms/${organizationId}/tc-jobs/${tcJobId}/${timestamp}-${file.name}`

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    // Create photo record
    const photo = await sql`
      INSERT INTO job_completion_form_photos (
        completion_form_id,
        question_id,
        photo_url,
        caption,
        photo_type,
        uploaded_by_user_id,
        uploaded_at
      ) VALUES (
        ${formId},
        ${questionId},
        ${blob.url},
        ${caption},
        ${photoType},
        ${userId},
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      photo: photo[0],
      message: 'Photo uploaded successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Error uploading TC completion form photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
