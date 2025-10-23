import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

// GET - Fetch Xero account codes for expenses
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user and their organization
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organization
    const orgs = await sql`
      SELECT o.*
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (orgs.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const organization = orgs[0]

    // Check if Xero is connected
    const xeroConnections = await sql`
      SELECT *
      FROM xero_connections
      WHERE organization_id = ${organization.id}
      AND expires_at > NOW()
      LIMIT 1
    `

    if (xeroConnections.length === 0) {
      return NextResponse.json(
        { error: 'Xero not connected or token expired' },
        { status: 400 }
      )
    }

    const xeroConnection = xeroConnections[0]

    // Fetch account codes from Xero
    const xeroResponse = await fetch('https://api.xero.com/api.xro/2.0/Accounts', {
      headers: {
        Authorization: `Bearer ${xeroConnection.access_token}`,
        'xero-tenant-id': xeroConnection.tenant_id,
        Accept: 'application/json',
      },
    })

    if (!xeroResponse.ok) {
      throw new Error('Failed to fetch Xero accounts')
    }

    const xeroData = await xeroResponse.json()

    // Filter for expense accounts (Type = EXPENSE or DIRECTCOSTS)
    const expenseAccounts = xeroData.Accounts.filter(
      (account: any) =>
        (account.Type === 'EXPENSE' || account.Type === 'DIRECTCOSTS') &&
        account.Status === 'ACTIVE'
    ).map((account: any) => ({
      code: account.Code,
      name: account.Name,
      type: account.Type,
      taxType: account.TaxType,
      description: account.Description,
    }))

    return NextResponse.json({
      accounts: expenseAccounts,
    })
  } catch (error) {
    console.error('Error fetching Xero account codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Xero account codes' },
      { status: 500 }
    )
  }
}
