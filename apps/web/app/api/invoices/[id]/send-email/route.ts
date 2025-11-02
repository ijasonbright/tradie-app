import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'
import { sendEmail } from '@/lib/email/ses'

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
      SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company
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

    // Generate public invoice link
    const invoiceLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tradie-app-web.vercel.app'}/public/invoice/${id}`

    // Convert plain text message to HTML
    const htmlBody = message.replace(/\n/g, '<br>')

    // Prepare from email
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@tradieapp.com'

    // Send email via AWS SES
    await sendEmail({
      to: email,
      from: fromEmail,
      subject,
      htmlBody: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${htmlBody}
            <br><br>
            <a href="${invoiceLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Invoice Online
            </a>
            <br><br>
            <p style="color: #666; font-size: 12px;">Invoice Number: ${invoice.invoice_number}</p>
          </body>
        </html>
      `,
      textBody: message + `\n\nView invoice online: ${invoiceLink}\n\nInvoice Number: ${invoice.invoice_number}`,
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
