import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// Verify API key from Property Pal
function verifyApiKey(req: Request): boolean {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.PROPERTY_PAL_API_KEY

  // For development, allow if no key is set
  if (!expectedKey) return true

  return apiKey === expectedKey
}

// POST - Create a pending invite for a Property Pal supplier to join TradieApp
export async function POST(req: Request) {
  try {
    if (!verifyApiKey(req)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await req.json()
    const {
      email,
      supplier_name,
      supplier_id,
      agency_id,
      agency_name,
      invite_token,
      categories,
    } = body

    if (!email || !supplier_id || !agency_id || !invite_token) {
      return NextResponse.json(
        { error: 'email, supplier_id, agency_id, and invite_token required' },
        { status: 400 }
      )
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Check if email already exists
    const existing = await sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${email})
    `

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists in TradieApp' },
        { status: 400 }
      )
    }

    // Store the pending invite in a new table
    // For now, we'll create the invite record
    // When user signs up with this email, we'll auto-link them

    // First, ensure the pending_property_pal_invites table exists
    await sql`
      CREATE TABLE IF NOT EXISTS pending_property_pal_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        supplier_name VARCHAR(255),
        property_pal_supplier_id INTEGER NOT NULL,
        property_pal_agency_id INTEGER NOT NULL,
        property_pal_agency_name VARCHAR(255),
        invite_token VARCHAR(255) NOT NULL UNIQUE,
        categories TEXT[],
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        accepted_at TIMESTAMP,
        organization_id UUID REFERENCES organizations(id)
      )
    `

    // Check if invite already exists for this supplier
    const existingInvite = await sql`
      SELECT id FROM pending_property_pal_invites
      WHERE property_pal_supplier_id = ${supplier_id}
      AND property_pal_agency_id = ${agency_id}
      AND status = 'pending'
    `

    if (existingInvite.length > 0) {
      // Update existing invite
      await sql`
        UPDATE pending_property_pal_invites SET
          email = ${email},
          supplier_name = ${supplier_name},
          invite_token = ${invite_token},
          categories = ${categories || []},
          created_at = NOW()
        WHERE property_pal_supplier_id = ${supplier_id}
        AND property_pal_agency_id = ${agency_id}
        AND status = 'pending'
      `
    } else {
      // Create new invite
      await sql`
        INSERT INTO pending_property_pal_invites (
          email,
          supplier_name,
          property_pal_supplier_id,
          property_pal_agency_id,
          property_pal_agency_name,
          invite_token,
          categories
        ) VALUES (
          ${email},
          ${supplier_name},
          ${supplier_id},
          ${agency_id},
          ${agency_name},
          ${invite_token},
          ${categories || []}
        )
      `
    }

    // TODO: Send email to supplier with signup link
    // For now, log the invite
    console.log(`Property Pal invite created for ${email} (supplier: ${supplier_name}, agency: ${agency_name})`)

    // In a real implementation, you would send an email here:
    // await sendEmail({
    //   to: email,
    //   subject: `${agency_name} has invited you to TradieApp`,
    //   template: 'property-pal-invite',
    //   data: { supplier_name, agency_name, signupUrl: `${process.env.NEXTAUTH_URL}/sign-up?invite=${invite_token}` }
    // })

    return NextResponse.json({
      success: true,
      message: 'Invite created successfully',
      invite_token,
    })
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
