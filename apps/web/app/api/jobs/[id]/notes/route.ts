import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch all notes for a job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Check job exists and user has access
    const jobs = await sql`
      SELECT j.* FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch notes with user names
    const notes = await sql`
      SELECT
        jn.*,
        u.full_name as user_name
      FROM job_notes jn
      LEFT JOIN users u ON jn.user_id = u.id
      WHERE jn.job_id = ${jobId}
      ORDER BY jn.created_at DESC
    `

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Add note to job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    if (!body.noteText) {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 })
    }

    // Check job exists and user has access
    const jobs = await sql`
      SELECT j.* FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Create note
    const notes = await sql`
      INSERT INTO job_notes (
        job_id, user_id, note_text, note_type
      ) VALUES (
        ${jobId},
        ${user.id},
        ${body.noteText},
        ${body.noteType || 'general'}
      ) RETURNING *
    `

    return NextResponse.json({ note: notes[0] }, { status: 201 })
  } catch (error) {
    console.error('Error adding note:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
