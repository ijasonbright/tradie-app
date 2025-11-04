import { NextRequest, NextResponse } from 'next/server'
import { checkInvoiceReminders } from '../../../../lib/reminders/check-invoice-reminders'
import { checkMonthlyStatements } from '../../../../lib/reminders/check-monthly-statements'

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

    console.log('[Cron] Starting reminder check job...')
    const startTime = Date.now()

    // Run both checks in parallel
    const [invoiceResults, statementResults] = await Promise.all([
      checkInvoiceReminders(),
      checkMonthlyStatements(),
    ])

    const duration = Date.now() - startTime
    console.log(`[Cron] Reminder check job completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      invoiceReminders: invoiceResults,
      monthlyStatements: statementResults,
      timestamp: new Date().toISOString(),
    })
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
