import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// POST - Convert quote to job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    const sql = neon(process.env.DATABASE_URL!)

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get quote with full details
    const quotes = await sql`
      SELECT q.*, c.site_address_line1, c.site_address_line2, c.site_city, c.site_state, c.site_postcode
      FROM quotes q
      INNER JOIN organization_members om ON q.organization_id = om.organization_id
      INNER JOIN clients c ON q.client_id = c.id
      WHERE q.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (quotes.length === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = quotes[0]

    // Verify quote is accepted
    if (quote.status !== 'accepted') {
      return NextResponse.json({ error: 'Quote must be accepted before converting to job' }, { status: 400 })
    }

    // Check if already converted
    if (quote.converted_to_job_id) {
      return NextResponse.json({ error: 'Quote has already been converted to a job', jobId: quote.converted_to_job_id }, { status: 400 })
    }

    // Check permissions
    const membership = await sql`
      SELECT * FROM organization_members
      WHERE organization_id = ${quote.organization_id}
      AND user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    const member = membership[0]
    if (member.role !== 'owner' && member.role !== 'admin' && !member.can_create_jobs) {
      return NextResponse.json({ error: 'Insufficient permissions to create jobs' }, { status: 403 })
    }

    // Generate job number
    const jobCount = await sql`
      SELECT COUNT(*) as count FROM jobs WHERE organization_id = ${quote.organization_id}
    `
    const jobNumber = `JOB-${String(Number(jobCount[0].count) + 1).padStart(5, '0')}`

    // Create job from quote
    const jobs = await sql`
      INSERT INTO jobs (
        organization_id, client_id, created_by_user_id,
        job_number, title, description, job_type, status, priority,
        pricing_type,
        site_address_line1, site_address_line2,
        site_city, site_state, site_postcode,
        quoted_amount, quote_id,
        created_at, updated_at
      ) VALUES (
        ${quote.organization_id},
        ${quote.client_id},
        ${user.id},
        ${jobNumber},
        ${quote.title || 'Job from Quote ' + quote.quote_number},
        ${quote.description || null},
        ${'installation'}, -- default job type, can be updated
        ${'quoted'}, -- status starts as quoted
        ${'medium'}, -- default priority
        ${'fixed'}, -- fixed price since it came from a quote
        ${quote.site_address_line1 || null},
        ${quote.site_address_line2 || null},
        ${quote.site_city || null},
        ${quote.site_state || null},
        ${quote.site_postcode || null},
        ${quote.total_amount}, -- quoted amount = quote total
        ${quote.id}, -- link to original quote
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const newJob = jobs[0]

    // Update quote with converted job ID
    await sql`
      UPDATE quotes
      SET converted_to_job_id = ${newJob.id}, updated_at = NOW()
      WHERE id = ${id}
    `

    // If quote had a deposit that was paid, we could optionally:
    // 1. Create a payment record on the job
    // 2. Create a deposit invoice
    // For now, we'll just track it via the quote relationship

    return NextResponse.json({
      success: true,
      job: newJob,
      message: 'Quote successfully converted to job',
    })
  } catch (error) {
    console.error('Error converting quote to job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
