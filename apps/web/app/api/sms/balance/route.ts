import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const userOrgs = await sql`
      SELECT o.sms_credits
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = (
        SELECT id FROM users WHERE clerk_user_id = ${userId}
      )
      AND om.status = 'active'
      LIMIT 1
    `

    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      credits: userOrgs[0].sms_credits || 0,
    })
  } catch (error) {
    console.error('Error fetching SMS balance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
