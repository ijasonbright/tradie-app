import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - List all quotes for user's organizations
export async function GET(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    // Build query based on filters
    let quotes

    if (status && clientId) {
      quotes = await sql`
        SELECT q.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name
        FROM quotes q
        INNER JOIN organizations o ON q.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON q.client_id = c.id
        LEFT JOIN users u ON q.created_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND q.status = ${status} AND q.client_id = ${clientId}
        ORDER BY q.created_at DESC
      `
    } else if (status) {
      quotes = await sql`
        SELECT q.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name
        FROM quotes q
        INNER JOIN organizations o ON q.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON q.client_id = c.id
        LEFT JOIN users u ON q.created_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND q.status = ${status}
        ORDER BY q.created_at DESC
      `
    } else if (clientId) {
      quotes = await sql`
        SELECT q.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name
        FROM quotes q
        INNER JOIN organizations o ON q.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON q.client_id = c.id
        LEFT JOIN users u ON q.created_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND q.client_id = ${clientId}
        ORDER BY q.created_at DESC
      `
    } else {
      quotes = await sql`
        SELECT q.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name
        FROM quotes q
        INNER JOIN organizations o ON q.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON q.client_id = c.id
        LEFT JOIN users u ON q.created_by_user_id = u.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        ORDER BY q.created_at DESC
      `
    }

    return NextResponse.json({ quotes })
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new quote
export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const body = await req.json()

    // Validate required fields
    if (!body.organizationId || !body.clientId || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, clientId, title' },
        { status: 400 }
      )
    }

    // Check user has permission in this organization
    const members = await sql`
      SELECT role, can_create_quotes FROM organization_members
      WHERE organization_id = ${body.organizationId}
      AND user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    const member = members[0]
    if (member.role !== 'owner' && member.role !== 'admin' && !member.can_create_quotes) {
      return NextResponse.json({ error: 'No permission to create quotes' }, { status: 403 })
    }

    // Generate quote number
    const year = new Date().getFullYear()
    const quoteCount = await sql`
      SELECT COUNT(*) as count FROM quotes
      WHERE organization_id = ${body.organizationId}
      AND quote_number LIKE ${'QTE-' + year + '-%'}
    `
    const quoteNumber = `QTE-${year}-${String(Number(quoteCount[0].count) + 1).padStart(3, '0')}`

    // Calculate totals
    const subtotal = parseFloat(body.subtotal || '0')
    const gstAmount = parseFloat(body.gstAmount || (subtotal * 0.1).toFixed(2))
    const totalAmount = subtotal + gstAmount

    // Create quote
    const quotes = await sql`
      INSERT INTO quotes (
        organization_id, quote_number, client_id, created_by_user_id,
        title, description, status, subtotal, gst_amount, total_amount,
        valid_until_date, notes, created_at, updated_at
      ) VALUES (
        ${body.organizationId},
        ${quoteNumber},
        ${body.clientId},
        ${user.id},
        ${body.title},
        ${body.description || null},
        ${body.status || 'draft'},
        ${subtotal},
        ${gstAmount},
        ${totalAmount},
        ${body.validUntilDate || null},
        ${body.notes || null},
        NOW(),
        NOW()
      ) RETURNING *
    `

    return NextResponse.json({ quote: quotes[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
