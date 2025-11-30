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

// POST - Check if an email exists in TradieApp and return organization info
export async function POST(req: Request) {
  try {
    if (!verifyApiKey(req)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Look up user by email and get their organization
    const results = await sql`
      SELECT
        u.id as user_id,
        u.email,
        o.id as organization_id,
        o.name as organization_name,
        om.role
      FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      INNER JOIN organizations o ON om.organization_id = o.id
      WHERE LOWER(u.email) = LOWER(${email})
      AND om.status = 'active'
      AND (om.role = 'owner' OR om.role = 'admin')
      LIMIT 1
    `

    if (results.length === 0) {
      return NextResponse.json({
        exists: false,
        message: 'No TradieApp account found with this email',
      })
    }

    const user = results[0]

    return NextResponse.json({
      exists: true,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
    })
  } catch (error) {
    console.error('Error checking email:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
