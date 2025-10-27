import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/jobs/[id]/fix-rates - Fix rates for a job and its time logs
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = await params
    const body = await req.json()
    const { tradeTypeId } = body

    if (!tradeTypeId) {
      return NextResponse.json(
        { error: 'tradeTypeId is required' },
        { status: 400 }
      )
    }

    // Get trade type rates
    const tradeTypes = await sql`
      SELECT
        id,
        name,
        default_employee_hourly_rate as cost_rate,
        client_hourly_rate as billing_rate
      FROM trade_types
      WHERE id = ${tradeTypeId}
      LIMIT 1
    `

    if (tradeTypes.length === 0) {
      return NextResponse.json(
        { error: 'Trade type not found' },
        { status: 404 }
      )
    }

    const tradeType = tradeTypes[0]
    const costRate = parseFloat(tradeType.cost_rate || 0)
    const billingRate = parseFloat(tradeType.billing_rate || 0)

    // Update job with trade_type_id
    await sql`
      UPDATE jobs
      SET trade_type_id = ${tradeTypeId}, updated_at = NOW()
      WHERE id = ${jobId}
    `

    // Get all time logs that need fixing (those with 0 or null rates)
    const timeLogs = await sql`
      SELECT id, total_hours
      FROM job_time_logs
      WHERE job_id = ${jobId}
      AND (hourly_rate IS NULL OR hourly_rate = 0 OR labor_cost IS NULL OR labor_cost = 0)
      AND total_hours IS NOT NULL
      AND total_hours > 0
    `

    let updatedCount = 0

    // Update each time log
    for (const log of timeLogs) {
      const hours = parseFloat(log.total_hours)
      const laborCost = (hours * costRate).toFixed(2)
      const billingAmount = (hours * billingRate).toFixed(2)

      await sql`
        UPDATE job_time_logs
        SET
          hourly_rate = ${costRate},
          labor_cost = ${laborCost},
          billing_amount = ${billingAmount},
          updated_at = NOW()
        WHERE id = ${log.id}
      `
      updatedCount++
    }

    return NextResponse.json({
      success: true,
      message: `Updated job with trade type and fixed ${updatedCount} time log(s)`,
      tradeType: {
        id: tradeType.id,
        name: tradeType.name,
        costRate,
        billingRate,
      },
      timeLogsUpdated: updatedCount,
    })
  } catch (error) {
    console.error('Error fixing rates:', error)
    return NextResponse.json(
      { error: 'Failed to fix rates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
