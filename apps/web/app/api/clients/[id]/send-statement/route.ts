import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { auth } from '@clerk/nextjs/server'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { sendStatementEmail } from '../../../../../lib/reminders/send-statement-email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[id]/send-statement
 * Manually send a monthly statement to a specific client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const sql = neon(process.env.DATABASE_URL!)
    const clientId = params.id

    // Get user from database
    const users = await sql`
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get organization where user is a member
    const orgs = await sql`
      SELECT o.id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgId = orgs[0].id

    // Get client details
    const clientResults = await sql`
      SELECT * FROM clients
      WHERE id = ${clientId}
      AND organization_id = ${orgId}
      LIMIT 1
    `

    if (clientResults.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    const client = clientResults[0]

    if (!client.email) {
      return NextResponse.json(
        { error: 'Client has no email address' },
        { status: 400 }
      )
    }

    // Get all invoices for this client
    const clientInvoices = await sql`
      SELECT * FROM invoices
      WHERE organization_id = ${orgId}
      AND client_id = ${clientId}
      ORDER BY due_date
    `

    if (clientInvoices.length === 0) {
      return NextResponse.json(
        { error: 'Client has no invoices' },
        { status: 400 }
      )
    }

    // Calculate total outstanding
    const outstandingInvoices = clientInvoices.filter((inv: any) =>
      inv.status === 'sent' ||
      inv.status === 'overdue' ||
      inv.status === 'partially_paid'
    )

    const totalOutstanding = outstandingInvoices.reduce((sum: number, inv: any) => {
      const total = parseFloat(inv.total_amount)
      const paid = parseFloat(inv.paid_amount || '0')
      return sum + (total - paid)
    }, 0)

    // Send statement
    try {
      await sendStatementEmail({
        client,
        invoices: clientInvoices,
        organizationId: orgId,
        totalOutstanding,
      })

      return NextResponse.json({
        success: true,
        message: `Statement sent to ${client.email}`,
        summary: {
          clientName: client.companyName || `${client.firstName} ${client.lastName}`,
          totalInvoices: clientInvoices.length,
          outstandingInvoices: outstandingInvoices.length,
          totalOutstanding: totalOutstanding.toFixed(2),
        },
      })
    } catch (error) {
      console.error('[API] Error sending statement:', error)
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send statement',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[API] Error in send-statement endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
