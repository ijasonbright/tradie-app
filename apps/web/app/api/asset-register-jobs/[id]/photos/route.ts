import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET /api/asset-register-jobs/[id]/photos - List all photos for an asset register job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
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

    const sql = neon(process.env.DATABASE_URL!)
    const { id: jobId } = await params

    const photos = await sql`
      SELECT
        arjp.*,
        u.full_name as uploaded_by_name
      FROM asset_register_job_photos arjp
      LEFT JOIN users u ON u.id = arjp.uploaded_by_user_id
      WHERE arjp.asset_register_job_id = ${jobId}
      ORDER BY arjp.created_at DESC
    `

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}

// POST /api/asset-register-jobs/[id]/photos - Upload a photo
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Try to get auth from Clerk (web) first
    let clerkUserId: string | null = null

    try {
      const authResult = await auth()
      clerkUserId = authResult.userId
    } catch (error) {
      // Clerk auth failed, try JWT token (mobile)
    }

    // If no Clerk auth, try mobile JWT token
    if (!clerkUserId) {
      const authHeader = req.headers.get('authorization')
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

    const sql = neon(process.env.DATABASE_URL!)
    const { id: jobId } = await params

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const caption = formData.get('caption') as string
    const photoType = formData.get('photo_type') as string || 'general'
    const room = formData.get('room') as string || null
    const item = formData.get('item') as string || null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob
    const blob = await put(`asset-register-jobs/${jobId}/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })

    // Save to database
    const newPhoto = await sql`
      INSERT INTO asset_register_job_photos (
        asset_register_job_id,
        uploaded_by_user_id,
        photo_url,
        caption,
        photo_type,
        room,
        item,
        taken_at,
        created_at
      ) VALUES (
        ${jobId},
        ${user.id},
        ${blob.url},
        ${caption || null},
        ${photoType},
        ${room},
        ${item},
        NOW(),
        NOW()
      )
      RETURNING *
    `

    // Return response with url field that mobile app expects
    return NextResponse.json({
      success: true,
      photo: newPhoto[0],
      url: blob.url,
    })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
