import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  console.log('Invitation verification endpoint called')
  try {
    if (!sql) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { token } = await context.params
    console.log('Verifying invitation token:', token.substring(0, 10) + '...')

    // Find invitation by token in pending_invitations table
    const result = await sql`
      SELECT
        pi.id,
        pi.email,
        pi.full_name,
        pi.phone,
        pi.role,
        pi.employment_type,
        pi.primary_trade_id,
        pi.hourly_rate,
        pi.billing_rate,
        pi.invitation_sent_at,
        pi.can_create_jobs,
        pi.can_edit_all_jobs,
        pi.can_create_invoices,
        pi.can_view_financials,
        pi.can_approve_expenses,
        pi.can_approve_timesheets,
        pi.requires_trade_license,
        pi.requires_police_check,
        pi.requires_working_with_children,
        pi.requires_public_liability,
        o.name as organization_name,
        o.id as organization_id
      FROM pending_invitations pi
      JOIN organizations o ON o.id = pi.organization_id
      WHERE pi.invitation_token = ${token}
      AND pi.status = 'pending'
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

    // Return invitation data with all compliance requirements from the database
    const invitationData = {
      id: invitation.id,
      organization_id: invitation.organization_id,
      organization_name: invitation.organization_name,
      role: invitation.role,
      employment_type: invitation.employment_type,
      email: invitation.email,
      full_name: invitation.full_name,
      phone: invitation.phone,
      primary_trade_id: invitation.primary_trade_id,
      hourly_rate: invitation.hourly_rate,
      billing_rate: invitation.billing_rate,
      can_create_jobs: invitation.can_create_jobs,
      can_edit_all_jobs: invitation.can_edit_all_jobs,
      can_create_invoices: invitation.can_create_invoices,
      can_view_financials: invitation.can_view_financials,
      can_approve_expenses: invitation.can_approve_expenses,
      can_approve_timesheets: invitation.can_approve_timesheets,
      requires_trade_license: invitation.requires_trade_license,
      requires_police_check: invitation.requires_police_check,
      requires_working_with_children: invitation.requires_working_with_children,
      requires_public_liability: invitation.requires_public_liability,
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
