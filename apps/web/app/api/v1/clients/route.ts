import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { withApiKeyAuth, ApiKeyPayload } from '@/lib/api/api-key-auth'
import { triggerClientWebhook } from '@/lib/api/webhooks'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/clients
 * List clients for the organization (API key authenticated)
 */
export const GET = withApiKeyAuth(
  async (request: NextRequest, { apiKey }: { params: Promise<Record<string, string>>; apiKey: ApiKeyPayload }) => {
    const sql = neon(process.env.DATABASE_URL!)
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const clientType = searchParams.get('client_type')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    let clients
    if (search) {
      const searchPattern = `%${search}%`
      clients = await sql`
        SELECT
          id,
          client_type,
          is_company,
          company_name,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          site_address_line1,
          site_address_line2,
          site_city,
          site_state,
          site_postcode,
          billing_address_same_as_site,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_postcode,
          abn,
          notes,
          preferred_contact_method,
          created_at,
          updated_at
        FROM clients
        WHERE organization_id = ${apiKey.organizationId}
        AND (
          first_name ILIKE ${searchPattern}
          OR last_name ILIKE ${searchPattern}
          OR company_name ILIKE ${searchPattern}
          OR email ILIKE ${searchPattern}
          OR phone ILIKE ${searchPattern}
        )
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else if (clientType) {
      clients = await sql`
        SELECT
          id,
          client_type,
          is_company,
          company_name,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          site_address_line1,
          site_address_line2,
          site_city,
          site_state,
          site_postcode,
          billing_address_same_as_site,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_postcode,
          abn,
          notes,
          preferred_contact_method,
          created_at,
          updated_at
        FROM clients
        WHERE organization_id = ${apiKey.organizationId}
        AND client_type = ${clientType}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    } else {
      clients = await sql`
        SELECT
          id,
          client_type,
          is_company,
          company_name,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          site_address_line1,
          site_address_line2,
          site_city,
          site_state,
          site_postcode,
          billing_address_same_as_site,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_postcode,
          abn,
          notes,
          preferred_contact_method,
          created_at,
          updated_at
        FROM clients
        WHERE organization_id = ${apiKey.organizationId}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    }

    // Format response
    const formattedClients = clients.map((c: any) => ({
      id: c.id,
      client_type: c.client_type,
      is_company: c.is_company,
      company_name: c.company_name,
      first_name: c.first_name,
      last_name: c.last_name,
      name: c.company_name || `${c.first_name} ${c.last_name}`.trim(),
      email: c.email,
      phone: c.phone,
      mobile: c.mobile,
      site_address: {
        line1: c.site_address_line1,
        line2: c.site_address_line2,
        city: c.site_city,
        state: c.site_state,
        postcode: c.site_postcode,
      },
      billing_address: c.billing_address_same_as_site ? null : {
        line1: c.billing_address_line1,
        line2: c.billing_address_line2,
        city: c.billing_city,
        state: c.billing_state,
        postcode: c.billing_postcode,
      },
      abn: c.abn,
      notes: c.notes,
      preferred_contact_method: c.preferred_contact_method,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }))

    return NextResponse.json({
      clients: formattedClients,
      count: formattedClients.length,
      limit,
      offset,
    })
  },
  { requiredPermission: 'clients.read' }
)

/**
 * POST /api/v1/clients
 * Create a new client (API key authenticated)
 */
export const POST = withApiKeyAuth(
  async (request: NextRequest, { apiKey }: { params: Promise<Record<string, string>>; apiKey: ApiKeyPayload }) => {
    const sql = neon(process.env.DATABASE_URL!)
    const body = await request.json()

    // Validate required fields
    const { first_name, last_name, company_name, email, phone } = body

    if (!email && !phone) {
      return NextResponse.json({ error: 'Either email or phone is required' }, { status: 400 })
    }

    if (!company_name && (!first_name || !last_name)) {
      return NextResponse.json({ error: 'Either company_name or both first_name and last_name are required' }, { status: 400 })
    }

    // Check for duplicate email
    if (email) {
      const existing = await sql`
        SELECT id FROM clients
        WHERE organization_id = ${apiKey.organizationId}
        AND email = ${email}
        LIMIT 1
      `
      if (existing.length > 0) {
        return NextResponse.json({
          error: 'A client with this email already exists',
          existing_client_id: existing[0].id,
        }, { status: 409 })
      }
    }

    // Create the client
    const result = await sql`
      INSERT INTO clients (
        organization_id,
        client_type,
        is_company,
        company_name,
        first_name,
        last_name,
        email,
        phone,
        mobile,
        site_address_line1,
        site_address_line2,
        site_city,
        site_state,
        site_postcode,
        billing_address_same_as_site,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_postcode,
        abn,
        notes,
        preferred_contact_method
      ) VALUES (
        ${apiKey.organizationId},
        ${body.client_type || 'residential'},
        ${body.is_company || !!company_name},
        ${company_name || null},
        ${first_name || null},
        ${last_name || null},
        ${email || null},
        ${phone || null},
        ${body.mobile || null},
        ${body.site_address?.line1 || null},
        ${body.site_address?.line2 || null},
        ${body.site_address?.city || null},
        ${body.site_address?.state || null},
        ${body.site_address?.postcode || null},
        ${body.billing_address ? false : true},
        ${body.billing_address?.line1 || null},
        ${body.billing_address?.line2 || null},
        ${body.billing_address?.city || null},
        ${body.billing_address?.state || null},
        ${body.billing_address?.postcode || null},
        ${body.abn || null},
        ${body.notes || null},
        ${body.preferred_contact_method || 'email'}
      )
      RETURNING *
    `

    const client = result[0]

    // Trigger webhook
    await triggerClientWebhook(apiKey.organizationId, 'client.created', {
      client_id: client.id,
      client_type: client.client_type,
      is_company: client.is_company,
      company_name: client.company_name,
      first_name: client.first_name,
      last_name: client.last_name,
      name: client.company_name || `${client.first_name} ${client.last_name}`.trim(),
      email: client.email,
      phone: client.phone,
      mobile: client.mobile,
      site_address: {
        line1: client.site_address_line1,
        line2: client.site_address_line2,
        city: client.site_city,
        state: client.site_state,
        postcode: client.site_postcode,
      },
      created_at: client.created_at,
    })

    return NextResponse.json({
      client: {
        id: client.id,
        client_type: client.client_type,
        is_company: client.is_company,
        company_name: client.company_name,
        first_name: client.first_name,
        last_name: client.last_name,
        name: client.company_name || `${client.first_name} ${client.last_name}`.trim(),
        email: client.email,
        phone: client.phone,
        mobile: client.mobile,
        site_address: {
          line1: client.site_address_line1,
          line2: client.site_address_line2,
          city: client.site_city,
          state: client.site_state,
          postcode: client.site_postcode,
        },
        created_at: client.created_at,
      },
      message: 'Client created successfully',
    }, { status: 201 })
  },
  { requiredPermission: 'clients.write' }
)
