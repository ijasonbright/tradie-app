import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// POST /api/subcontractors/payments/[paymentId]/sync-xero - Sync payment to Xero as Bill
export async function POST(
  req: Request,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { paymentId } = params

    // Get user from database
    const users = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = users[0]

    // Get user's organization
    const members = await sql`
      SELECT organization_id, role
      FROM organization_members
      WHERE user_id = ${user.id}
      AND status = 'active'
      LIMIT 1
    `

    if (members.length === 0) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const { organization_id, role } = members[0]

    // Check permissions
    const canSync = role === 'owner' || role === 'admin'
    if (!canSync) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get payment with subcontractor details
    const payments = await sql`
      SELECT
        sp.*,
        u.full_name as subcontractor_name,
        u.email as subcontractor_email
      FROM subcontractor_payments sp
      INNER JOIN users u ON sp.subcontractor_user_id = u.id
      WHERE sp.id = ${paymentId}
      AND sp.organization_id = ${organization_id}
      LIMIT 1
    `

    if (payments.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const payment = payments[0]

    // Check if already synced
    if (payment.xero_bill_id) {
      return NextResponse.json({
        success: true,
        message: 'Payment already synced to Xero',
        xero_bill_id: payment.xero_bill_id,
      })
    }

    // Get Xero connection
    const xeroConnections = await sql`
      SELECT * FROM xero_connections
      WHERE organization_id = ${organization_id}
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

    // Get payment items
    const items = await sql`
      SELECT * FROM subcontractor_payment_items
      WHERE payment_id = ${paymentId}
      ORDER BY created_at ASC
    `

    // Prepare Xero Bill payload
    const lineItems = items.map((item: any) => ({
      Description: item.description,
      Quantity: 1,
      UnitAmount: parseFloat(item.amount),
      AccountCode: '400', // Default expense account - should be configurable
      TaxType: 'NONE', // Subcontractor payments typically don't include GST
    }))

    const billPayload: any = {
      Type: 'ACCPAY', // Accounts Payable (Bill)
      Contact: {
        Name: payment.subcontractor_name,
        EmailAddress: payment.subcontractor_email,
        // Mark as supplier
        IsSupplier: true,
      },
      Date: payment.paid_date || payment.created_at,
      DueDate: payment.paid_date || payment.created_at,
      Status: payment.status === 'paid' ? 'PAID' : 'AUTHORISED',
      Reference: payment.reference_number || `Payment ${payment.id}`,
      LineItems: lineItems,
    }

    // If payment is marked as paid, add payment
    if (payment.status === 'paid' && payment.paid_date) {
      billPayload.Payments = [
        {
          Date: payment.paid_date,
          Amount: parseFloat(payment.paid_amount),
          Account: {
            Code: '090', // Default bank account - should be configurable
          },
        },
      ]
    }

    // Send to Xero API
    const xeroResponse = await fetch('https://api.xero.com/api.xro/2.0/Bills', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${xeroConnection.access_token}`,
        'Xero-tenant-id': xeroConnection.tenant_id,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ Bills: [billPayload] }),
    })

    if (!xeroResponse.ok) {
      const errorData = await xeroResponse.json()
      console.error('Xero API error:', errorData)

      // Log sync error
      await sql`
        INSERT INTO xero_sync_logs (
          organization_id,
          sync_type,
          entity_type,
          entity_id,
          action,
          status,
          error_message,
          request_payload,
          response_payload,
          created_at
        ) VALUES (
          ${organization_id},
          'bills',
          'subcontractor_payment',
          ${paymentId},
          'create',
          'error',
          ${JSON.stringify(errorData)},
          ${JSON.stringify(billPayload)},
          ${JSON.stringify(errorData)},
          NOW()
        )
      `

      return NextResponse.json(
        { error: 'Failed to sync to Xero', details: errorData },
        { status: 500 }
      )
    }

    const xeroData = await xeroResponse.json()
    const xeroBill = xeroData.Bills?.[0]

    if (!xeroBill) {
      return NextResponse.json(
        { error: 'No bill returned from Xero' },
        { status: 500 }
      )
    }

    // Update payment with Xero bill ID
    await sql`
      UPDATE subcontractor_payments
      SET
        xero_bill_id = ${xeroBill.BillID},
        last_synced_at = NOW()
      WHERE id = ${paymentId}
    `

    // Log successful sync
    await sql`
      INSERT INTO xero_sync_logs (
        organization_id,
        sync_type,
        entity_type,
        entity_id,
        action,
        status,
        xero_id,
        request_payload,
        response_payload,
        created_at
      ) VALUES (
        ${organization_id},
        'bills',
        'subcontractor_payment',
        ${paymentId},
        'create',
        'success',
        ${xeroBill.BillID},
        ${JSON.stringify(billPayload)},
        ${JSON.stringify(xeroBill)},
        NOW()
      )
    `

    return NextResponse.json({
      success: true,
      message: 'Payment synced to Xero successfully',
      xero_bill_id: xeroBill.BillID,
      xero_bill_number: xeroBill.BillNumber,
    })
  } catch (error) {
    console.error('Error syncing payment to Xero:', error)
    return NextResponse.json(
      { error: 'Failed to sync payment to Xero' },
      { status: 500 }
    )
  }
}
