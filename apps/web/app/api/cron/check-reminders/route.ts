import { NextRequest, NextResponse } from 'next/server'
// TODO: Rewrite these functions to use raw Neon SQL instead of Drizzle ORM to fix build errors
// import { checkInvoiceReminders } from '../../../../lib/reminders/check-invoice-reminders'
// import { checkMonthlyStatements } from '../../../../lib/reminders/check-monthly-statements'

/**
 * Cron job endpoint to check and send reminders
 * Schedule: Daily at 9:00 AM AEST
 *
 * Vercel Cron Configuration (add to vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/check-reminders",
 *       "schedule": "0 9 * * *"
 *     }
 *   ]
 * }
 *
 * Security: Protected by CRON_SECRET environment variable
 *
 * NOTE: Temporarily disabled until reminder check functions are rewritten to use raw Neon SQL
 * The existing functions use Drizzle ORM which causes build-time database connection errors.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[Cron] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron job not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Temporarily return not implemented
    console.log('[Cron] Cron endpoint called but temporarily disabled')
    return NextResponse.json({
      success: false,
      error: 'Cron job temporarily disabled - reminder functions need to be rewritten to use raw SQL instead of Drizzle ORM',
      note: 'API endpoints for manual reminders (/api/invoices/[id]/send-reminder and /api/clients/[id]/send-statement) are still available',
      timestamp: new Date().toISOString(),
    }, { status: 501 })

  } catch (error) {
    console.error('[Cron] Error in reminder check job:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Allow POST as well for manual testing
export async function POST(request: NextRequest) {
  return GET(request)
}
