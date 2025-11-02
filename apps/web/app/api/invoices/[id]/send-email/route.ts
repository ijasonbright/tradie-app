import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { sendEmail } from '@/lib/email/ses'
import { generateInvoiceEmailHTML, generateInvoiceEmailText } from '@/lib/email/templates/invoice'

export const dynamic = 'force-dynamic'

// POST - Send invoice via email
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Parse request body
    const body = await req.json()
    const { email, subject, message } = body

    if (!email || !subject || !message) {
      return NextResponse.json({ error: 'Email, subject, and message are required' }, { status: 400 })
    }

    // Get invoice with organization check
    const invoices = await sql`
      SELECT i.*, o.name as organization_name, o.logo_url, o.primary_color,
             c.company_name, c.first_name, c.last_name, c.is_company
      FROM invoices i
      INNER JOIN organizations o ON i.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON i.client_id = c.id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Format client name
    const clientName = invoice.is_company
      ? invoice.company_name
      : `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim()

    // Format currency
    const formatCurrency = (amount: number | string) => {
      const num = typeof amount === 'string' ? parseFloat(amount) : amount
      return `$${num.toFixed(2)}`
    }

    // Format date
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    }

    // Prepare from email
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@tradieapp.com'

    // Generate branded email using template
    const htmlBody = generateInvoiceEmailHTML({
      invoiceNumber: invoice.invoice_number,
      clientName,
      organizationName: invoice.organization_name,
      totalAmount: formatCurrency(invoice.total_amount),
      dueDate: formatDate(invoice.due_date),
      logoUrl: invoice.logo_url || undefined,
      primaryColor: invoice.primary_color || undefined,
      bankName: invoice.bank_name || undefined,
      bankBsb: invoice.bank_bsb || undefined,
      bankAccountNumber: invoice.bank_account_number || undefined,
      bankAccountName: invoice.bank_account_name || undefined,
      // paymentLink: undefined, // TODO: Add Stripe payment link when implemented
    })

    const textBody = generateInvoiceEmailText({
      invoiceNumber: invoice.invoice_number,
      clientName,
      organizationName: invoice.organization_name,
      totalAmount: formatCurrency(invoice.total_amount),
      dueDate: formatDate(invoice.due_date),
    })

    // Send email via AWS SES
    await sendEmail({
      to: email,
      from: fromEmail,
      subject,
      htmlBody,
      textBody,
    })

    return NextResponse.json({
      success: true,
      message: 'Invoice email sent successfully',
    })
  } catch (error) {
    console.error('Error sending invoice email:', error)

    // Return detailed error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to send email',
        details: errorMessage,
        message: errorMessage
      },
      { status: 500 }
    )
  }
}
