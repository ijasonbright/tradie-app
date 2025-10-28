import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'


// GET /api/jobs/[id]/debug-rates - Debug rate calculation
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params

    // Get job with trade type info
    const jobs = await sql`
      SELECT
        j.id,
        j.job_number,
        j.title,
        j.trade_type_id,
        tt.name as trade_type_name,
        tt.default_employee_hourly_rate as cost_rate,
        tt.client_hourly_rate as billing_rate
      FROM jobs j
      LEFT JOIN trade_types tt ON tt.id = j.trade_type_id
      WHERE j.id = ${jobId}
      LIMIT 1
    `

    if (jobs.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = jobs[0]

    // Get time logs
    const timeLogs = await sql`
      SELECT
        id,
        user_id,
        start_time,
        end_time,
        total_hours,
        hourly_rate,
        labor_cost,
        billing_amount,
        status
      FROM job_time_logs
      WHERE job_id = ${jobId}
      ORDER BY start_time DESC
    `

    // Get all trade types for this org
    const orgJobs = await sql`SELECT organization_id FROM jobs WHERE id = ${jobId} LIMIT 1`
    const tradeTypes = await sql`
      SELECT
        id,
        name,
        default_employee_hourly_rate,
        client_hourly_rate,
        is_active
      FROM trade_types
      WHERE organization_id = ${orgJobs[0].organization_id}
      ORDER BY name
    `

    return NextResponse.json({
      job: {
        id: job.id,
        job_number: job.job_number,
        title: job.title,
        trade_type_id: job.trade_type_id,
        trade_type_name: job.trade_type_name,
        cost_rate: job.cost_rate,
        billing_rate: job.billing_rate,
      },
      timeLogs,
      availableTradeTypes: tradeTypes,
      diagnosis: {
        hasTradeType: !!job.trade_type_id,
        hasRates: !!(job.cost_rate && job.billing_rate),
        timeLogsCount: timeLogs.length,
        timeLogsWithoutRates: timeLogs.filter((log: any) => !log.hourly_rate || parseFloat(log.hourly_rate) === 0).length,
      }
    })
  } catch (error) {
    console.error('Error debugging rates:', error)
    return NextResponse.json(
      { error: 'Failed to debug rates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
