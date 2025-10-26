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

    // Get user's internal ID
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    const today = new Date()
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(today.getDate() + 30)

    // Get user's expiring documents
    const expiringDocs = await sql`
      SELECT
        id,
        document_type,
        title,
        expiry_date,
        document_number
      FROM user_documents
      WHERE user_id = ${user.id}
      AND expiry_date IS NOT NULL
      AND expiry_date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}
      ORDER BY expiry_date ASC
    `

    const expired = expiringDocs.filter((doc: any) => new Date(doc.expiry_date) < today)
    const expiringSoon = expiringDocs.filter((doc: any) => {
      const expiryDate = new Date(doc.expiry_date)
      return expiryDate >= today && expiryDate <= thirtyDaysFromNow
    })

    // If user is owner/admin, also get team member expiring documents
    const orgMembership = await sql`
      SELECT organization_id, role
      FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
      AND role IN ('owner', 'admin')
      LIMIT 1
    `

    let teamExpiringDocs = []
    if (orgMembership.length > 0) {
      const orgId = orgMembership[0].organization_id

      teamExpiringDocs = await sql`
        SELECT
          ud.id,
          ud.document_type,
          ud.title,
          ud.expiry_date,
          u.full_name as team_member_name
        FROM user_documents ud
        JOIN users u ON u.id = ud.user_id
        JOIN organization_members om ON om.user_id = u.id
        WHERE om.organization_id = ${orgId}
        AND ud.user_id != ${user.id}
        AND ud.expiry_date IS NOT NULL
        AND ud.expiry_date <= ${thirtyDaysFromNow.toISOString().split('T')[0]}
        AND om.status = 'active'
        ORDER BY ud.expiry_date ASC
      `
    }

    const teamExpired = teamExpiringDocs.filter((doc: any) => new Date(doc.expiry_date) < today)
    const teamExpiringSoon = teamExpiringDocs.filter((doc: any) => {
      const expiryDate = new Date(doc.expiry_date)
      return expiryDate >= today && expiryDate <= thirtyDaysFromNow
    })

    return NextResponse.json({
      personal: {
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        total: expiringDocs.length,
        documents: expiringDocs.slice(0, 5), // Only return first 5 for preview
      },
      team: {
        expired: teamExpired.length,
        expiringSoon: teamExpiringSoon.length,
        total: teamExpiringDocs.length,
        documents: teamExpiringDocs.slice(0, 5),
      },
    })
  } catch (error) {
    console.error('Error fetching expiring documents:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
