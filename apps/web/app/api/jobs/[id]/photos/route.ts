import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'


// GET /api/jobs/[id]/photos - List all photos for a job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params

    const photos = await sql`
      SELECT
        jp.*,
        u.full_name as uploaded_by_name
      FROM job_photos jp
      JOIN users u ON u.id = jp.uploaded_by_user_id
      WHERE jp.job_id = ${jobId}
      ORDER BY jp.uploaded_at DESC
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

// POST /api/jobs/[id]/photos - Upload a photo
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse form data
    const formData = await req.formData()
    const photo = formData.get('photo') as File
    const caption = formData.get('caption') as string
    const photoType = formData.get('photoType') as string || 'during'

    if (!photo) {
      return NextResponse.json(
        { error: 'No photo provided' },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob
    const blob = await put(`jobs/${jobId}/${Date.now()}-${photo.name}`, photo, {
      access: 'public',
    })

    // Save to database
    const newPhoto = await sql`
      INSERT INTO job_photos (
        job_id,
        uploaded_by_user_id,
        photo_url,
        caption,
        photo_type,
        uploaded_at
      ) VALUES (
        ${jobId},
        ${user.id},
        ${blob.url},
        ${caption || null},
        ${photoType},
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      photo: newPhoto[0],
    })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
