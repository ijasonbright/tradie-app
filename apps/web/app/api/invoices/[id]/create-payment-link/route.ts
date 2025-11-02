import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { createInvoicePaymentLink, generatePublicToken } from '@/lib/stripe/payment-links'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await params
    const body = await req.json()
    const { amount: customAmount } = body // Optional: for partial payments

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get the invoice (with organization membership check)
    const invoices = await sql`
      SELECT
        i.*,
        c.first_name,
        c.last_name,
        c.company_name,
        c.is_company
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN organization_members om ON i.organization_id = om.organization_id
      WHERE i.id = ${invoiceId}
        AND om.user_id = ${user.id}
        AND om.status = 'active'
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Calculate amount to request
    const totalAmount = parseFloat(invoice.total_amount)
    const paidAmount = parseFloat(invoice.paid_amount || '0')
    const remainingAmount = totalAmount - paidAmount

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { error: 'Invoice is already fully paid' },
        { status: 400 }
      )
    }

    // Use custom amount if provided, otherwise use remaining amount
    let paymentAmount = remainingAmount
    if (customAmount) {
      const requestedAmount = parseFloat(customAmount)
      if (requestedAmount <= 0 || requestedAmount > remainingAmount) {
        return NextResponse.json(
          { error: 'Invalid payment amount' },
          { status: 400 }
        )
      }
      paymentAmount = requestedAmount
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

    // Create description
    const description = customAmount
      ? `Partial payment for Invoice #${invoice.invoice_number}`
      : `Payment for Invoice #${invoice.invoice_number}`

    // Create Stripe Payment Link
    const { paymentLink } = await createInvoicePaymentLink({
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      organizationId: invoice.organization_id,
      amount: paymentAmount,
      publicToken,
      clientName,
      description,
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
      publicUrl: `${process.env.NEXT_PUBLIC_APP_URL}/public/invoices/${publicToken}`,
      paymentAmount,
      remainingAmount,
      isPartialPayment: customAmount ? true : false,
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
