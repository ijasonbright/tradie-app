import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { createInvoicePaymentLink, generatePublicToken } from '@/lib/stripe/payment-links'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
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

    const { id: invoiceId } = await params

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get the invoice (with organization membership check)
    const invoices = await sql`
      SELECT
        inv.*,
        c.first_name,
        c.last_name,
        c.company_name,
        c.is_company
      FROM invoices inv
      JOIN clients c ON inv.client_id = c.id
      JOIN organization_members om ON inv.organization_id = om.organization_id
      WHERE inv.id = ${invoiceId}
        AND om.user_id = ${user.id}
        AND om.status = 'active'
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'This invoice has already been paid' },
        { status: 400 }
      )
    }

    // Calculate amount to pay (total - already paid)
    const totalAmount = parseFloat(invoice.total_amount || '0')
    const paidAmount = parseFloat(invoice.paid_amount || '0')
    const amountDue = totalAmount - paidAmount

    if (amountDue <= 0) {
      return NextResponse.json(
        { error: 'No amount due on this invoice' },
        { status: 400 }
      )
    }

    // Generate public token if not already exists
    let publicToken = invoice.public_token
    if (!publicToken) {
      publicToken = generatePublicToken()
      await sql`
        UPDATE invoices
        SET public_token = ${publicToken}, updated_at = NOW()
        WHERE id = ${invoiceId}
      `
    }

    // Create client name
    const clientName = invoice.is_company
      ? invoice.company_name
      : `${invoice.first_name} ${invoice.last_name}`

    // Create Stripe Payment Link
    const { paymentLink } = await createInvoicePaymentLink({
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      organizationId: invoice.organization_id,
      amount: amountDue,
      publicToken,
      clientName,
      description: invoice.description || undefined,
    })

    // Update invoice with payment link URL
    await sql`
      UPDATE invoices
      SET
        stripe_payment_link_id = ${paymentLink.id},
        stripe_payment_link_url = ${paymentLink.url},
        updated_at = NOW()
      WHERE id = ${invoiceId}
    `

    return NextResponse.json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        url: paymentLink.url,
      },
      publicUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/invoices/${publicToken}`,
      amountDue,
    })
  } catch (error) {
    console.error('Error creating invoice payment link:', error)
    return NextResponse.json(
      {
        error: 'Failed to create payment link',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
