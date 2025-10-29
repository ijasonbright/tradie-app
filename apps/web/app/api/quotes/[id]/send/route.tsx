import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { generateQuotePDF } from '@/lib/pdf/generate-quote-pdf'
import { sendEmail } from '@/lib/email/ses'
import { generateQuoteEmailHTML, generateQuoteEmailText } from '@/lib/email/templates/quote'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Send quote email to client with PDF attachment
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

    // Get quote with full details
    const quotes = await sql`
      SELECT q.*, o.name as organization_name,
             c.company_name, c.first_name, c.last_name, c.is_company,
             c.email as client_email, c.phone as client_phone
      FROM quotes q
      INNER JOIN organizations o ON q.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON q.client_id = c.id
      WHERE q.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Get organization details
    const organizations = await sql`
      SELECT * FROM organizations WHERE id = ${quote.organization_id} LIMIT 1
    `
    const organization = organizations[0]

    // Get line items
    const lineItems = await sql`
      SELECT * FROM quote_line_items
      WHERE quote_id = ${id}
      ORDER BY line_order ASC
    `

    // Generate PDF
    const pdfData = {
      quote,
      lineItems,
      organization,
    } as any

    const pdfBytes = await generateQuotePDF(pdfData)
    const pdfBuffer = Buffer.from(pdfBytes)

    // Get client name
    const clientName = quote.is_company && quote.company_name
      ? quote.company_name
      : [quote.first_name, quote.last_name].filter(Boolean).join(' ') || 'Valued Client'

    // Format currency
    const formatCurrency = (amount: string) => {
      const num = parseFloat(amount)
      return `$${num.toFixed(2)}`
    }

    // Format date
    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    // Prepare email content using templates
    const subject = `Quote ${quote.quote_number} from ${organization.name}`

    const htmlBody = generateQuoteEmailHTML({
      quoteNumber: quote.quote_number,
      clientName,
      organizationName: organization.name,
      totalAmount: formatCurrency(quote.total_amount),
      validUntilDate: formatDate(quote.valid_until_date),
      organizationEmail: organization.email || undefined,
      organizationPhone: organization.phone || undefined,
    })

    const textBody = generateQuoteEmailText({
      quoteNumber: quote.quote_number,
      clientName,
      organizationName: organization.name,
      totalAmount: formatCurrency(quote.total_amount),
      validUntilDate: formatDate(quote.valid_until_date),
      organizationEmail: organization.email || undefined,
      organizationPhone: organization.phone || undefined,
    })

    // Determine FROM email address
    const fromEmail = process.env.DEFAULT_FROM_EMAIL || 'hello@taskforce.com.au'
    const replyToEmail = organization.email || undefined

    // Send email with PDF attachment
    await sendEmail({
      to: quote.client_email,
      from: fromEmail,
      replyTo: replyToEmail,
      subject: subject,
      htmlBody: htmlBody,
      textBody: textBody,
      attachments: [
        {
          filename: `${quote.quote_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    // Update quote: mark as sent
    await sql`
      UPDATE quotes
      SET sent_at = NOW(), status = 'sent', updated_at = NOW()
      WHERE id = ${id}
    `

    return NextResponse.json({
      success: true,
      message: `Quote sent to ${quote.client_email}`,
    })
  } catch (error) {
    console.error('Error sending quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
