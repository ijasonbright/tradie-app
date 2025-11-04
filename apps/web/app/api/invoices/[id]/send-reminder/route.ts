import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { auth } from '@clerk/nextjs/server'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { sendReminderEmail } from '../../../../../lib/reminders/send-reminder-email'
import { sendReminderSms } from '../../../../../lib/reminders/send-reminder-sms'

export const dynamic = 'force-dynamic'

/**
 * POST /api/invoices/[id]/send-reminder
 * Manually send a reminder for a specific invoice
 *
 * Body:
 * {
 *   method: 'email' | 'sms' | 'both'
 * }
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
    const invoiceId = params.id
    const body = await request.json()
    const method = body.method || 'email'

    if (!['email', 'sms', 'both'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be "email", "sms", or "both"' },
        { status: 400 }
      )
    }

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

    // Get invoice with client details
    const invoiceResults = await sql`
      SELECT
        i.*,
        c.id as client_id,
        c.company_name as client_company_name,
        c.first_name as client_first_name,
        c.last_name as client_last_name,
        c.email as client_email,
        c.phone as client_phone,
        c.mobile as client_mobile
      FROM invoices i
      INNER JOIN clients c ON i.client_id = c.id
      WHERE i.id = ${invoiceId}
      AND i.organization_id = ${orgId}
      LIMIT 1
    `

    if (invoiceResults.length === 0) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    const row = invoiceResults[0]

    // Reconstruct invoice and client objects
    const invoice = {
      id: row.id,
      invoiceNumber: row.invoice_number,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
      dueDate: row.due_date,
      status: row.status,
      organizationId: row.organization_id,
      clientId: row.client_id,
    }

    const client = {
      id: row.client_id,
      companyName: row.client_company_name,
      firstName: row.client_first_name,
      lastName: row.client_last_name,
      email: row.client_email,
      phone: row.client_phone,
      mobile: row.client_mobile,
    }

    // Check if invoice is paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot send reminder for paid invoice' },
        { status: 400 }
      )
    }

    // Calculate days until/overdue
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(invoice.dueDate)
    dueDate.setHours(0, 0, 0, 0)
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    const reminderData = {
      invoice,
      client,
      organizationId: orgId,
      daysBeforeDue: daysUntilDue > 0 ? daysUntilDue : undefined,
      daysOverdue: daysUntilDue < 0 ? Math.abs(daysUntilDue) : undefined,
    }

    const results = {
      email: null as any,
      sms: null as any,
    }

    // Send email reminder
    if (method === 'email' || method === 'both') {
      try {
        results.email = await sendReminderEmail(reminderData)
      } catch (error) {
        console.error('[API] Error sending email reminder:', error)
        results.email = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send email',
        }
      }
    }

    // Send SMS reminder
    if (method === 'sms' || method === 'both') {
      try {
        results.sms = await sendReminderSms(reminderData)
      } catch (error) {
        console.error('[API] Error sending SMS reminder:', error)
        results.sms = {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send SMS',
        }
      }
    }

    // Determine overall success
    const emailSuccess = method !== 'email' && method !== 'both' || results.email?.success
    const smsSuccess = method !== 'sms' && method !== 'both' || results.sms?.success
    const overallSuccess = emailSuccess && smsSuccess

    return NextResponse.json({
      success: overallSuccess,
      method,
      results,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        daysUntilDue,
      },
    })
  } catch (error) {
    console.error('[API] Error in send-reminder endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
