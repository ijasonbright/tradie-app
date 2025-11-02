import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-09-30.clover' })
  : null

export async function POST(req: Request) {
  try {
    if (!sql || !stripe) {
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      )
    }

    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const metadata = session.metadata || {}

      // Check if this is an SMS credit purchase
      if (metadata.type === 'sms_credits') {
        const organizationId = session.metadata.organization_id
        const creditsToAdd = parseInt(session.metadata.credits || '0')
        const amountPaid = (session.amount_total || 0) / 100 // Convert from cents to dollars

        if (!organizationId || creditsToAdd === 0) {
          console.error('Missing metadata in Stripe session:', session.metadata)
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Get current SMS credits
        const orgs = await sql`
          SELECT sms_credits FROM organizations WHERE id = ${organizationId}
        `

        if (orgs.length === 0) {
          console.error('Organization not found:', organizationId)
          return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
        }

        const currentCredits = orgs[0].sms_credits || 0
        const newBalance = currentCredits + creditsToAdd

        // Update organization credits
        await sql`
          UPDATE organizations
          SET sms_credits = ${newBalance}
          WHERE id = ${organizationId}
        `

        // Log the transaction
        await sql`
          INSERT INTO sms_transactions (
            organization_id,
            transaction_type,
            credits_amount,
            cost_amount,
            balance_after,
            description,
            stripe_payment_intent_id,
            created_at
          ) VALUES (
            ${organizationId},
            'purchase',
            ${creditsToAdd},
            ${amountPaid},
            ${newBalance},
            ${`Purchased ${creditsToAdd} SMS credits`},
            ${session.payment_intent as string},
            NOW()
          )
        `

        console.log(`Added ${creditsToAdd} SMS credits to organization ${organizationId}. New balance: ${newBalance}`)
      }

      // Handle quote deposit payment
      else if (metadata.type === 'quote_deposit') {
        const quoteId = metadata.quote_id
        const organizationId = metadata.organization_id
        const amountPaid = (session.amount_total || 0) / 100

        if (!quoteId || !organizationId) {
          console.error('Missing metadata for quote deposit:', metadata)
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Update quote with deposit payment info
        await sql`
          UPDATE quotes
          SET
            deposit_paid = true,
            deposit_paid_at = NOW(),
            deposit_payment_intent_id = ${session.payment_intent as string},
            updated_at = NOW()
          WHERE id = ${quoteId} AND organization_id = ${organizationId}
        `

        console.log(`Quote deposit paid for quote ${quoteId}: $${amountPaid}`)
      }

      // Handle invoice payment
      else if (metadata.type === 'invoice_payment') {
        const invoiceId = metadata.invoice_id
        const organizationId = metadata.organization_id
        const amountPaid = (session.amount_total || 0) / 100

        if (!invoiceId || !organizationId) {
          console.error('Missing metadata for invoice payment:', metadata)
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Get current invoice details
        const invoices = await sql`
          SELECT paid_amount, total_amount FROM invoices WHERE id = ${invoiceId}
        `

        if (invoices.length === 0) {
          console.error('Invoice not found:', invoiceId)
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
        }

        const currentPaidAmount = parseFloat(invoices[0].paid_amount || '0')
        const totalAmount = parseFloat(invoices[0].total_amount || '0')
        const newPaidAmount = currentPaidAmount + amountPaid

        // Determine new status
        let newStatus = 'sent'
        if (newPaidAmount >= totalAmount) {
          newStatus = 'paid'
        } else if (newPaidAmount > 0) {
          newStatus = 'partially_paid'
        }

        // Update invoice
        await sql`
          UPDATE invoices
          SET
            paid_amount = ${newPaidAmount},
            status = ${newStatus},
            paid_date = ${newStatus === 'paid' ? sql`NOW()` : sql`paid_date`},
            stripe_payment_intent_id = ${session.payment_intent as string},
            updated_at = NOW()
          WHERE id = ${invoiceId} AND organization_id = ${organizationId}
        `

        // Record the payment
        await sql`
          INSERT INTO invoice_payments (
            invoice_id,
            payment_date,
            amount,
            payment_method,
            reference_number,
            notes,
            recorded_by_user_id,
            created_at
          ) VALUES (
            ${invoiceId},
            NOW(),
            ${amountPaid},
            'stripe',
            ${session.payment_intent as string},
            'Online payment via Stripe',
            (SELECT created_by_user_id FROM invoices WHERE id = ${invoiceId}),
            NOW()
          )
        `

        console.log(`Invoice payment received for invoice ${invoiceId}: $${amountPaid}. New status: ${newStatus}`)
      }

      // Handle payment request
      else if (metadata.type === 'payment_request') {
        const paymentRequestId = metadata.payment_request_id
        const organizationId = metadata.organization_id
        const amountPaid = (session.amount_total || 0) / 100

        if (!paymentRequestId || !organizationId) {
          console.error('Missing metadata for payment request:', metadata)
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Get current payment request details
        const requests = await sql`
          SELECT amount_paid, amount_requested FROM payment_requests WHERE id = ${paymentRequestId}
        `

        if (requests.length === 0) {
          console.error('Payment request not found:', paymentRequestId)
          return NextResponse.json({ error: 'Payment request not found' }, { status: 404 })
        }

        const currentPaidAmount = parseFloat(requests[0].amount_paid || '0')
        const requestedAmount = parseFloat(requests[0].amount_requested || '0')
        const newPaidAmount = currentPaidAmount + amountPaid

        // Determine new status
        let newStatus = 'pending'
        if (newPaidAmount >= requestedAmount) {
          newStatus = 'paid'
        } else if (newPaidAmount > 0) {
          newStatus = 'partially_paid'
        }

        // Update payment request
        await sql`
          UPDATE payment_requests
          SET
            amount_paid = ${newPaidAmount},
            status = ${newStatus},
            paid_at = ${newStatus === 'paid' ? sql`NOW()` : sql`paid_at`},
            stripe_payment_intent_id = ${session.payment_intent as string},
            updated_at = NOW()
          WHERE id = ${paymentRequestId} AND organization_id = ${organizationId}
        `

        console.log(`Payment request fulfilled for ${paymentRequestId}: $${amountPaid}. New status: ${newStatus}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
