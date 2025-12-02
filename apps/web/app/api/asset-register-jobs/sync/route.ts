import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// Shared secret for authenticating sync requests from Property Pal
const SYNC_SECRET = process.env.PROPERTY_PAL_SYNC_SECRET || 'property-pal-sync-secret'

/**
 * POST - Sync asset register request from Property Pal to Tradie App
 *
 * This endpoint is called by Property Pal when:
 * 1. A new asset register request is created
 * 2. An existing request is updated
 * 3. A request is assigned to a supplier
 *
 * It creates/updates the asset_register_jobs record in Tradie App
 * and optionally sends a push notification to the assigned user
 */
export async function POST(req: Request) {
  try {
    // Verify sync authorization
    const authHeader = req.headers.get('authorization')
    if (!authHeader || authHeader !== `Bearer ${SYNC_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const sql = neon(process.env.DATABASE_URL!)

    // Required fields from Property Pal
    const {
      external_request_id,     // Property Pal asset_register_request_id
      external_property_id,    // Property Pal property_id
      external_agency_id,      // Property Pal agency_id
      status,
      priority,
      scheduled_date,
      notes,
      // Property details
      property_address_street,
      property_address_suburb,
      property_address_state,
      property_address_postcode,
      property_type,
      bedrooms,
      bathrooms,
      owner_name,
      owner_phone,
      owner_email,
      tenant_name,
      tenant_phone,
      tenant_email,
      access_instructions,
      // Assignment (optional)
      assigned_supplier_external_id,
    } = body

    if (!external_request_id || !external_property_id || !external_agency_id) {
      return NextResponse.json({
        error: 'Missing required fields: external_request_id, external_property_id, external_agency_id'
      }, { status: 400 })
    }

    // Find organization by external_agency_id
    const organizations = await sql`
      SELECT * FROM organizations
      WHERE external_agency_id = ${external_agency_id}
      LIMIT 1
    `

    if (organizations.length === 0) {
      return NextResponse.json({
        error: 'Organization not found for external_agency_id',
        external_agency_id,
      }, { status: 404 })
    }

    const organization = organizations[0]

    // Find or create property
    let properties = await sql`
      SELECT * FROM properties
      WHERE organization_id = ${organization.id}
      AND external_property_id = ${external_property_id}
      LIMIT 1
    `

    let property
    if (properties.length === 0) {
      // Create the property
      const newProperties = await sql`
        INSERT INTO properties (
          organization_id, external_property_id,
          address_street, address_suburb, address_state, address_postcode,
          property_type, bedrooms, bathrooms,
          owner_name, owner_phone, owner_email,
          tenant_name, tenant_phone, tenant_email,
          access_instructions, synced_at,
          created_at, updated_at
        ) VALUES (
          ${organization.id}, ${external_property_id},
          ${property_address_street || null}, ${property_address_suburb || null},
          ${property_address_state || null}, ${property_address_postcode || null},
          ${property_type || null}, ${bedrooms || null}, ${bathrooms || null},
          ${owner_name || null}, ${owner_phone || null}, ${owner_email || null},
          ${tenant_name || null}, ${tenant_phone || null}, ${tenant_email || null},
          ${access_instructions || null}, NOW(),
          NOW(), NOW()
        )
        RETURNING *
      `
      property = newProperties[0]
    } else {
      // Update existing property
      const updatedProperties = await sql`
        UPDATE properties SET
          address_street = ${property_address_street || null},
          address_suburb = ${property_address_suburb || null},
          address_state = ${property_address_state || null},
          address_postcode = ${property_address_postcode || null},
          property_type = ${property_type || null},
          bedrooms = ${bedrooms || null},
          bathrooms = ${bathrooms || null},
          owner_name = ${owner_name || null},
          owner_phone = ${owner_phone || null},
          owner_email = ${owner_email || null},
          tenant_name = ${tenant_name || null},
          tenant_phone = ${tenant_phone || null},
          tenant_email = ${tenant_email || null},
          access_instructions = ${access_instructions || null},
          synced_at = NOW(),
          updated_at = NOW()
        WHERE id = ${properties[0].id}
        RETURNING *
      `
      property = updatedProperties[0]
    }

    // Find assigned user if supplier external ID provided
    let assignedUserId = null
    if (assigned_supplier_external_id) {
      // Look up supplier/user by external_supplier_id
      // This assumes suppliers are linked to users via organization_members with external_supplier_id
      const suppliers = await sql`
        SELECT u.id
        FROM users u
        INNER JOIN organization_members om ON u.id = om.user_id
        WHERE om.organization_id = ${organization.id}
        AND om.external_supplier_id = ${assigned_supplier_external_id}
        LIMIT 1
      `
      if (suppliers.length > 0) {
        assignedUserId = suppliers[0].id
      }
    }

    // Check if asset register job already exists
    const existingJobs = await sql`
      SELECT * FROM asset_register_jobs
      WHERE external_request_id = ${external_request_id}
      AND organization_id = ${organization.id}
      LIMIT 1
    `

    let job
    if (existingJobs.length > 0) {
      // Update existing job
      const updatedJobs = await sql`
        UPDATE asset_register_jobs SET
          property_id = ${property.id},
          status = ${status || 'CREATED'},
          priority = ${priority || 'MEDIUM'},
          scheduled_date = ${scheduled_date || null},
          notes = ${notes || null},
          assigned_to_user_id = ${assignedUserId},
          external_synced_at = NOW(),
          external_property_id = ${external_property_id},
          updated_at = NOW()
        WHERE id = ${existingJobs[0].id}
        RETURNING *
      `
      job = updatedJobs[0]
    } else {
      // Create new job
      const newJobs = await sql`
        INSERT INTO asset_register_jobs (
          organization_id, property_id, assigned_to_user_id,
          status, priority, scheduled_date, notes,
          external_request_id, external_source, external_synced_at, external_property_id,
          created_at, updated_at
        ) VALUES (
          ${organization.id}, ${property.id}, ${assignedUserId},
          ${status || 'CREATED'}, ${priority || 'MEDIUM'}, ${scheduled_date || null}, ${notes || null},
          ${external_request_id}, 'property_pal', NOW(), ${external_property_id},
          NOW(), NOW()
        )
        RETURNING *
      `
      job = newJobs[0]
    }

    // Send push notification if assigned to a user
    if (assignedUserId) {
      try {
        // Get user's push token
        const users = await sql`
          SELECT expo_push_token FROM users WHERE id = ${assignedUserId}
        `

        if (users.length > 0 && users[0].expo_push_token) {
          const address = [property_address_street, property_address_suburb].filter(Boolean).join(', ')

          // Send push notification via Expo
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: users[0].expo_push_token,
              title: 'New Asset Register Assigned',
              body: `You have been assigned an asset register at ${address}`,
              data: {
                type: 'asset_register_job',
                jobId: job.id,
              },
            }),
          })
        }
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError)
        // Don't fail the sync if push fails
      }
    }

    return NextResponse.json({
      success: true,
      job,
      property,
      isNew: existingJobs.length === 0,
    })
  } catch (error) {
    console.error('Error syncing asset register job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
