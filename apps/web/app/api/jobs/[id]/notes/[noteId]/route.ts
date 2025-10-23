import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// DELETE - Delete note
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: jobId, noteId } = await params
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
      SELECT j.*, om.role FROM jobs j
      INNER JOIN organization_members om ON j.organization_id = om.organization_id
      WHERE j.id = ${jobId}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Get note
    const notes = await sql`SELECT * FROM job_notes WHERE id = ${noteId} AND job_id = ${jobId} LIMIT 1`

    if (notes.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const note = notes[0]

    // Only owner, admin, or the person who created it can delete
    if (job.role !== 'owner' && job.role !== 'admin' && note.user_id !== user.id) {
      return NextResponse.json({ error: 'No permission to delete this note' }, { status: 403 })
    }

    // Delete note
    await sql`DELETE FROM job_notes WHERE id = ${noteId} AND job_id = ${jobId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
