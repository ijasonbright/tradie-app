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

    // Get user's organization and check permissions
    const userOrgs = await sql`
      SELECT om.organization_id, om.role
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE u.clerk_user_id = ${userId}
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
    `

    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found or insufficient permissions' },
        { status: 403 }
      )
    }

    const orgId = userOrgs[0].organization_id

    // Get all team members with their documents
    const teamMembers = await sql`
      SELECT
        u.id as user_id,
        u.full_name,
        u.email,
        om.role,
        om.status
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = ${orgId}
      AND om.status = 'active'
      ORDER BY
        CASE om.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'employee' THEN 3
          WHEN 'subcontractor' THEN 4
          ELSE 5
        END,
        u.full_name ASC
    `

    // Get all documents for these users
    const userIds = teamMembers.map((m: any) => m.user_id)

    let allDocuments: any[] = []
    if (userIds.length > 0) {
      allDocuments = await sql`
        SELECT
          user_id,
          id,
          document_type,
          title,
          expiry_date,
          ai_verification_status
        FROM user_documents
        WHERE user_id = ANY(${userIds})
        ORDER BY expiry_date ASC NULLS LAST
      `
    }

    // Calculate expiry status for each document
    const getExpiryStatus = (expiryDate: string | null) => {
      if (!expiryDate) return 'no_date'

      const today = new Date()
      const expiry = new Date(expiryDate)
      const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry < 0) return 'expired'
      if (daysUntilExpiry <= 30) return 'expiring_soon'
      if (daysUntilExpiry <= 90) return 'warning'
      return 'valid'
    }

    // Build compliance data for each team member
    const teamCompliance = teamMembers.map((member: any) => {
      const memberDocs = allDocuments
        .filter((doc: any) => doc.user_id === member.user_id)
        .map((doc: any) => ({
          ...doc,
          expiry_status: getExpiryStatus(doc.expiry_date),
        }))

      const expired_count = memberDocs.filter((d: any) => d.expiry_status === 'expired').length
      const expiring_soon_count = memberDocs.filter((d: any) =>
        d.expiry_status === 'expiring_soon' || d.expiry_status === 'warning'
      ).length

      return {
        user_id: member.user_id,
        full_name: member.full_name,
        email: member.email,
        role: member.role,
        status: member.status,
        documents: memberDocs,
        total_documents: memberDocs.length,
        expired_count,
        expiring_soon_count,
      }
    })

    return NextResponse.json({ teamCompliance })
  } catch (error) {
    console.error('Error fetching team compliance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team compliance' },
      { status: 500 }
    )
  }
}
