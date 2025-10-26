import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })
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

      // Check if this is an SMS credit purchase
      if (session.metadata?.type === 'sms_credits') {
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
