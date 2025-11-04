import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

/**
 * GET /api/reminders/settings
 * Get reminder settings for the current organization
 */
export async function GET(request: NextRequest) {
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
      const authHeader = request.headers.get('authorization')
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
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get organization where user is a member
    const orgs = await sql`
      SELECT o.id
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const orgId = orgs[0].id

    // Get settings for organization
    const settings = await sql`
      SELECT * FROM reminder_settings
      WHERE organization_id = ${orgId}
      LIMIT 1
    `

    if (settings.length === 0) {
      // Return default settings if none exist
      return NextResponse.json({
        organizationId: orgId,
        invoiceRemindersEnabled: true,
        reminderDaysBeforeDue: '7,3,1',
        reminderDaysAfterDue: '1,7,14',
        invoiceReminderMethod: 'email',
        enableSmsEscalation: true,
        smsEscalationDaysOverdue: 14,
        monthlyStatementsEnabled: true,
        statementDayOfMonth: 1,
        statementMethod: 'email',
        includeOnlyOutstanding: true,
      })
    }

    return NextResponse.json(settings[0])
  } catch (error) {
    console.error('[API] Error fetching reminder settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/reminders/settings
 * Update reminder settings for the current organization
 */
export async function PUT(request: NextRequest) {
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
      const authHeader = request.headers.get('authorization')
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
      SELECT id FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get organization where user is owner or admin
    const orgs = await sql`
      SELECT o.id, om.role
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      AND (om.role = 'owner' OR om.role = 'admin')
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'No organization found or insufficient permissions' }, { status: 403 })
    }

    const orgId = orgs[0].id
    const body = await request.json()

    // Validate input
    if (body.reminderDaysBeforeDue && typeof body.reminderDaysBeforeDue === 'string') {
      const days = body.reminderDaysBeforeDue.split(',').map((d: string) => parseInt(d.trim()))
      if (days.some((d: number) => isNaN(d) || d < 1)) {
        return NextResponse.json(
          { error: 'Invalid reminderDaysBeforeDue format' },
          { status: 400 }
        )
      }
    }

    if (body.reminderDaysAfterDue && typeof body.reminderDaysAfterDue === 'string') {
      const days = body.reminderDaysAfterDue.split(',').map((d: string) => parseInt(d.trim()))
      if (days.some((d: number) => isNaN(d) || d < 1)) {
        return NextResponse.json(
          { error: 'Invalid reminderDaysAfterDue format' },
          { status: 400 }
        )
      }
    }

    if (body.statementDayOfMonth && (body.statementDayOfMonth < 1 || body.statementDayOfMonth > 28)) {
      return NextResponse.json(
        { error: 'statementDayOfMonth must be between 1 and 28' },
        { status: 400 }
      )
    }

    // Check if settings exist
    const existing = await sql`
      SELECT id FROM reminder_settings WHERE organization_id = ${orgId} LIMIT 1
    `

    if (existing.length === 0) {
      // Create new settings
      const newSettings = await sql`
        INSERT INTO reminder_settings (
          organization_id,
          invoice_reminders_enabled,
          reminder_days_before_due,
          reminder_days_after_due,
          invoice_reminder_method,
          enable_sms_escalation,
          sms_escalation_days_overdue,
          monthly_statements_enabled,
          statement_day_of_month,
          statement_method,
          include_only_outstanding,
          created_at,
          updated_at
        ) VALUES (
          ${orgId},
          ${body.invoiceRemindersEnabled ?? true},
          ${body.reminderDaysBeforeDue ?? '7,3,1'},
          ${body.reminderDaysAfterDue ?? '1,7,14'},
          ${body.invoiceReminderMethod ?? 'email'},
          ${body.enableSmsEscalation ?? true},
          ${body.smsEscalationDaysOverdue ?? 14},
          ${body.monthlyStatementsEnabled ?? true},
          ${body.statementDayOfMonth ?? 1},
          ${body.statementMethod ?? 'email'},
          ${body.includeOnlyOutstanding ?? true},
          NOW(),
          NOW()
        )
        RETURNING *
      `

      return NextResponse.json(newSettings[0], { status: 201 })
    } else {
      // Update existing settings
      const updated = await sql`
        UPDATE reminder_settings
        SET
          invoice_reminders_enabled = ${body.invoiceRemindersEnabled ?? true},
          reminder_days_before_due = ${body.reminderDaysBeforeDue ?? '7,3,1'},
          reminder_days_after_due = ${body.reminderDaysAfterDue ?? '1,7,14'},
          invoice_reminder_method = ${body.invoiceReminderMethod ?? 'email'},
          enable_sms_escalation = ${body.enableSmsEscalation ?? true},
          sms_escalation_days_overdue = ${body.smsEscalationDaysOverdue ?? 14},
          monthly_statements_enabled = ${body.monthlyStatementsEnabled ?? true},
          statement_day_of_month = ${body.statementDayOfMonth ?? 1},
          statement_method = ${body.statementMethod ?? 'email'},
          include_only_outstanding = ${body.includeOnlyOutstanding ?? true},
          updated_at = NOW()
        WHERE organization_id = ${orgId}
        RETURNING *
      `

      return NextResponse.json(updated[0])
    }
  } catch (error) {
    console.error('[API] Error updating reminder settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
