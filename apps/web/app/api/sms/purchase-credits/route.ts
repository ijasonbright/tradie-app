import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-29.clover' })
  : null

// SMS Credit bundles (5¢ per credit)
const CREDIT_BUNDLES = {
  '100': { credits: 100, price: 500 }, // $5.00
  '500': { credits: 500, price: 2500 }, // $25.00
  '1000': { credits: 1000, price: 5000 }, // $50.00
  '5000': { credits: 5000, price: 25000 }, // $250.00
}

export async function POST(req: Request) {
  try {
    if (!sql || !stripe) {
      return NextResponse.json(
        { error: 'Service not configured' },
        { status: 500 }
      )
    }

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { bundleSize } = body

    if (!bundleSize || !CREDIT_BUNDLES[bundleSize as keyof typeof CREDIT_BUNDLES]) {
      return NextResponse.json(
        { error: 'Invalid bundle size. Choose from: 100, 500, 1000, 5000' },
        { status: 400 }
      )
    }

    const bundle = CREDIT_BUNDLES[bundleSize as keyof typeof CREDIT_BUNDLES]

    // Get user's organization
    const userOrgs = await sql`
      SELECT om.organization_id, o.name as organization_name, o.stripe_customer_id
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = (
        SELECT id FROM users WHERE clerk_user_id = ${userId}
      )
      AND om.status = 'active'
      AND om.role IN ('owner', 'admin')
      LIMIT 1
    `

    if (!userOrgs || userOrgs.length === 0) {
      return NextResponse.json(
        { error: 'No organization found or insufficient permissions' },
        { status: 403 }
      )
    }

    const org = userOrgs[0]

    // Create or get Stripe customer
    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          organization_id: org.organization_id,
          organization_name: org.organization_name,
        },
      })
      customerId = customer.id

      // Update organization with Stripe customer ID
      await sql`
        UPDATE organizations
        SET stripe_customer_id = ${customerId}
        WHERE id = ${org.organization_id}
      `
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `${bundle.credits} SMS Credits`,
              description: `${bundle.credits} SMS credits @ 5¢ each`,
            },
            unit_amount: bundle.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sms?success=true&credits=${bundle.credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/sms?cancelled=true`,
      metadata: {
        organization_id: org.organization_id,
        credits: bundle.credits.toString(),
        type: 'sms_credits',
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating SMS credit purchase:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
