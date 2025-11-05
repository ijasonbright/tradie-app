import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Try Clerk auth first (web)
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

    const userOrgs = await sql`
      SELECT om.organization_id
      FROM organization_members om
      JOIN users u ON om.user_id = u.id
      WHERE u.clerk_user_id = ${clerkUserId}
      AND om.status = 'active'
      LIMIT 1
    `

    if (userOrgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = userOrgs[0].organization_id

    const templates = await sql`
      SELECT
        t.id,
        t.organization_id,
        t.name,
        t.description,
        t.code,
        t.job_type,
        t.is_global,
        t.is_active,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT g.id)::integer as group_count,
        COUNT(DISTINCT q.id)::integer as question_count
      FROM completion_form_templates t
      LEFT JOIN completion_form_template_groups g ON g.template_id = t.id
      LEFT JOIN completion_form_template_questions q ON q.template_id = t.id
      WHERE (
        t.is_global = true
        OR t.organization_id = ${organizationId}
      )
      GROUP BY t.id
      ORDER BY t.name ASC
    `

    return NextResponse.json({
      templates,
      total: templates.length,
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
