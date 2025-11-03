import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all quotes for user's organizations
export async function GET(req: Request) {
  try {
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

    const body = await req.json()

    // Validate required fields
    if (!body.clientId || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, title' },
        { status: 400 }
      )
    }

    // Get user's organization (use provided organizationId or get the first active membership)
    let organizationId = body.organizationId

    if (!organizationId) {
      const memberships = await sql`
        SELECT organization_id, role FROM organization_members
        WHERE user_id = ${user.id}
        AND status = 'active'
        LIMIT 1
      `

      if (memberships.length === 0) {
        return NextResponse.json({ error: 'No active organization membership' }, { status: 403 })
      }

      organizationId = memberships[0].organization_id
    }

    // Check user has permission in this organization
    const members = await sql`
      SELECT role FROM organization_members
      WHERE organization_id = ${organizationId}
      AND user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    const member = members[0]
    // Only owners and admins can create quotes (or employees with permission in the future)
    if (member.role !== 'owner' && member.role !== 'admin') {
      return NextResponse.json({ error: 'No permission to create quotes' }, { status: 403 })
    }

    // Generate quote number
    const year = new Date().getFullYear()
    const quoteCount = await sql`
      SELECT COUNT(*) as count FROM quotes
      WHERE organization_id = ${organizationId}
      AND quote_number LIKE ${'QTE-' + year + '-%'}
    `
    const quoteNumber = `QTE-${year}-${String(Number(quoteCount[0].count) + 1).padStart(3, '0')}`

    // Calculate totals
    const subtotal = parseFloat(body.subtotal || '0')
    const gstAmount = parseFloat(body.gstAmount || (subtotal * 0.1).toFixed(2))
    const totalAmount = subtotal + gstAmount

    // Prepare deposit fields
    const depositRequired = body.depositRequired || false
    const depositPercentage = body.depositPercentage || null
    const depositAmount = body.depositAmount || null

    // Create quote with deposit fields
    const quotes = await sql`
      INSERT INTO quotes (
        organization_id, quote_number, client_id, created_by_user_id,
        title, description, status, subtotal, gst_amount, total_amount,
        valid_until_date, notes,
        deposit_required, deposit_percentage, deposit_amount,
        created_at, updated_at
      ) VALUES (
        ${organizationId},
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
        ${depositRequired},
        ${depositPercentage},
        ${depositAmount},
        NOW(),
        NOW()
      ) RETURNING *
    `

    const newQuote = quotes[0]

    // Insert line items if provided
    if (body.lineItems && Array.isArray(body.lineItems) && body.lineItems.length > 0) {
      for (let i = 0; i < body.lineItems.length; i++) {
        const item = body.lineItems[i]

        // Calculate line_total on server side to ensure it's never null
        const quantity = parseFloat(item.quantity || '0')
        const unitPrice = parseFloat(item.unitPrice || item.unit_price || '0')
        const gstAmount = parseFloat(item.gstAmount || item.gst_amount || '0')
        const lineTotal = (quantity * unitPrice) + gstAmount

        await sql`
          INSERT INTO quote_line_items (
            quote_id, item_type, description, quantity, unit_price, gst_amount, line_total, line_order
          ) VALUES (
            ${newQuote.id},
            ${item.itemType || item.item_type || 'service'},
            ${item.description},
            ${quantity},
            ${unitPrice},
            ${gstAmount},
            ${lineTotal},
            ${item.lineOrder !== undefined ? item.lineOrder : i}
          )
        `
      }
    }

    return NextResponse.json({ quote: newQuote }, { status: 201 })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
