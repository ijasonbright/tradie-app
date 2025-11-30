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

// POST - Confirm connection between Property Pal supplier and TradieApp organization
export async function POST(req: Request) {
  try {
    if (!verifyApiKey(req)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await req.json()
    const { organization_id, supplier_id, agency_id, agency_name } = body

    if (!organization_id || !supplier_id || !agency_id) {
      return NextResponse.json(
        { error: 'organization_id, supplier_id, and agency_id required' },
        { status: 400 }
      )
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Verify organization exists
    const orgs = await sql`
      SELECT id, name FROM organizations WHERE id = ${organization_id}
    `

    if (orgs.length === 0) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Update organization with Property Pal link
    await sql`
      UPDATE organizations SET
        external_agency_id = ${agency_id},
        external_source = 'property_pal',
        external_synced_at = NOW(),
        updated_at = NOW()
      WHERE id = ${organization_id}
    `

    // Log the connection for audit
    console.log(`Connected Property Pal supplier ${supplier_id} (agency: ${agency_name}) to TradieApp org ${organization_id}`)

    return NextResponse.json({
      success: true,
      organization_id,
      message: 'Connection established',
    })
  } catch (error) {
    console.error('Error connecting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
