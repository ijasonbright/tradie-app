import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - List all invoice payments for user's organizations
export async function GET(req: Request) {
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
      const authHeader = req.headers.get('authorization')
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

    const userId = clerkUserId

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get('invoiceId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query based on filters
    let payments

    if (invoiceId && startDate && endDate) {
      payments = await sql`
        SELECT ip.*,
               i.invoice_number, i.total_amount as invoice_total,
               c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as recorded_by_name
        FROM invoice_payments ip
        INNER JOIN invoices i ON ip.invoice_id = i.id
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON ip.recorded_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND ip.invoice_id = ${invoiceId}
        AND ip.payment_date >= ${startDate}
        AND ip.payment_date <= ${endDate}
        ORDER BY ip.payment_date DESC, ip.created_at DESC
      `
    } else if (invoiceId) {
      payments = await sql`
        SELECT ip.*,
               i.invoice_number, i.total_amount as invoice_total,
               c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as recorded_by_name
        FROM invoice_payments ip
        INNER JOIN invoices i ON ip.invoice_id = i.id
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON ip.recorded_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND ip.invoice_id = ${invoiceId}
        ORDER BY ip.payment_date DESC, ip.created_at DESC
      `
    } else if (startDate && endDate) {
      payments = await sql`
        SELECT ip.*,
               i.invoice_number, i.total_amount as invoice_total,
               c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as recorded_by_name
        FROM invoice_payments ip
        INNER JOIN invoices i ON ip.invoice_id = i.id
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON ip.recorded_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND ip.payment_date >= ${startDate}
        AND ip.payment_date <= ${endDate}
        ORDER BY ip.payment_date DESC, ip.created_at DESC
      `
    } else {
      // Get all payments for the user's organization(s)
      payments = await sql`
        SELECT ip.*,
               i.invoice_number, i.total_amount as invoice_total,
               c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as recorded_by_name
        FROM invoice_payments ip
        INNER JOIN invoices i ON ip.invoice_id = i.id
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON ip.recorded_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        ORDER BY ip.payment_date DESC, ip.created_at DESC
        LIMIT 100
      `
    }

    // Format payments with client name
    const formattedPayments = payments.map((payment: any) => ({
      ...payment,
      client_name: payment.is_company
        ? payment.company_name
        : `${payment.first_name || ''} ${payment.last_name || ''}`.trim(),
    }))

    return NextResponse.json({ payments: formattedPayments })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
