import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { token } = await context.params

    // Find invitation by token
    const result = await sql`
      SELECT
        om.id,
        om.role,
        u.email,
        u.full_name,
        u.phone,
        o.name as organization_name,
        om.invitation_sent_at
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.invitation_token = ${token}
      AND om.status = 'invited'
    `

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    const invitation = result[0]

    // Check if invitation is expired (7 days)
    const sentAt = new Date(invitation.invitation_sent_at)
    const expiryDate = new Date(sentAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    const now = new Date()

    if (now > expiryDate) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 410 }
      )
    }

    // TODO: Fetch compliance requirements (from a separate table or JSON field)
    // For now, return mock data
    const invitationData = {
      id: invitation.id,
      organization_name: invitation.organization_name,
      role: invitation.role,
      email: invitation.email,
      full_name: invitation.full_name,
      phone: invitation.phone,
      requires_trade_license: true,
      requires_police_check: false,
      requires_working_with_children: false,
      requires_public_liability: invitation.role === 'subcontractor',
    }

    return NextResponse.json({ invitation: invitationData })
  } catch (error) {
    console.error('Error verifying invitation:', error)
    return NextResponse.json(
      { error: 'Failed to verify invitation' },
      { status: 500 }
    )
  }
}
