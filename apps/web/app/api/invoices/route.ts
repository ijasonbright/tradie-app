import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// GET - List all invoices for user's organizations
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
    const jobId = searchParams.get('jobId')

    // Build query based on filters
    let invoices

    if (status && clientId) {
      invoices = await sql`
        SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name, j.job_number, j.title as job_title
        FROM invoices i
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND i.status = ${status} AND i.client_id = ${clientId}
        ORDER BY i.created_at DESC
      `
    } else if (status) {
      invoices = await sql`
        SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name, j.job_number, j.title as job_title
        FROM invoices i
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND i.status = ${status}
        ORDER BY i.created_at DESC
      `
    } else if (clientId) {
      invoices = await sql`
        SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name, j.job_number, j.title as job_title
        FROM invoices i
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND i.client_id = ${clientId}
        ORDER BY i.created_at DESC
      `
    } else if (jobId) {
      invoices = await sql`
        SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name, j.job_number, j.title as job_title
        FROM invoices i
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        AND i.job_id = ${jobId}
        ORDER BY i.created_at DESC
      `
    } else {
      invoices = await sql`
        SELECT i.*, o.name as organization_name, c.company_name, c.first_name, c.last_name, c.is_company,
               u.full_name as created_by_name, j.job_number, j.title as job_title
        FROM invoices i
        INNER JOIN organizations o ON i.organization_id = o.id
        INNER JOIN organization_members om ON o.id = om.organization_id
        INNER JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        LEFT JOIN jobs j ON i.job_id = j.id
        WHERE om.user_id = ${user.id} AND om.status = 'active'
        ORDER BY i.created_at DESC
      `
    }

    // Format invoices with client name
    const formattedInvoices = invoices.map((invoice: any) => ({
      ...invoice,
      client_name: invoice.is_company
        ? invoice.company_name
        : `${invoice.first_name || ''} ${invoice.last_name || ''}`.trim(),
    }))

    return NextResponse.json({ invoices: formattedInvoices })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Create new invoice
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
    if (!body.organizationId || !body.clientId || !body.issueDate || !body.dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, clientId, issueDate, dueDate' },
        { status: 400 }
      )
    }

    // Check user has permission in this organization
    const members = await sql`
      SELECT role, can_create_invoices FROM organization_members
      WHERE organization_id = ${body.organizationId}
      AND user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

    const member = members[0]
    if (member.role !== 'owner' && member.role !== 'admin' && !member.can_create_invoices) {
      return NextResponse.json({ error: 'No permission to create invoices' }, { status: 403 })
    }

    // Generate invoice number
    const year = new Date().getFullYear()
    const invoiceCount = await sql`
      SELECT COUNT(*) as count FROM invoices
      WHERE organization_id = ${body.organizationId}
      AND invoice_number LIKE ${'INV-' + year + '-%'}
    `
    const invoiceNumber = `INV-${year}-${String(Number(invoiceCount[0].count) + 1).padStart(3, '0')}`

    // Calculate totals
    const subtotal = parseFloat(body.subtotal || '0')
    const gstAmount = parseFloat(body.gstAmount || (subtotal * 0.1).toFixed(2))
    const totalAmount = subtotal + gstAmount

    // Generate unique public token for sharing
    const publicToken = crypto.randomBytes(16).toString('base64url')

    // Create invoice
    const invoices = await sql`
      INSERT INTO invoices (
        organization_id, invoice_number, job_id, client_id, created_by_user_id,
        status, subtotal, gst_amount, total_amount, paid_amount,
        issue_date, due_date, payment_terms, notes, footer_text,
        public_token,
        created_at, updated_at
      ) VALUES (
        ${body.organizationId},
        ${invoiceNumber},
        ${body.jobId || null},
        ${body.clientId},
        ${user.id},
        ${body.status || 'draft'},
        ${subtotal},
        ${gstAmount},
        ${totalAmount},
        0,
        ${body.issueDate},
        ${body.dueDate},
        ${body.paymentTerms || null},
        ${body.notes || null},
        ${body.footerText || null},
        ${publicToken},
        NOW(),
        NOW()
      ) RETURNING *
    `

    // If invoice is linked to a job, update the job's invoice_id
    if (body.jobId) {
      await sql`
        UPDATE jobs
        SET invoice_id = ${invoices[0].id}, updated_at = NOW()
        WHERE id = ${body.jobId}
      `
    }

    return NextResponse.json({ invoice: invoices[0] }, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
