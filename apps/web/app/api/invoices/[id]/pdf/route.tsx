import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { neon } from '@neondatabase/serverless'
import { generateInvoicePDF } from '@/lib/pdf/generate-invoice-pdf'

export const dynamic = 'force-dynamic'

// GET - Generate and download invoice PDF
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get user's internal ID
    const users = await sql`SELECT id FROM users WHERE clerk_user_id = ${userId} LIMIT 1`
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    // Get invoice with full details
    const invoices = await sql`
      SELECT i.*, o.name as organization_name,
             c.company_name, c.first_name, c.last_name, c.is_company,
             c.email as client_email, c.phone as client_phone, c.mobile as client_mobile,
             c.billing_address_line1, c.billing_address_line2, c.billing_city, c.billing_state, c.billing_postcode,
             j.job_number, j.title as job_title
      FROM invoices i
      INNER JOIN organizations o ON i.organization_id = o.id
      INNER JOIN organization_members om ON o.id = om.organization_id
      INNER JOIN clients c ON i.client_id = c.id
      LEFT JOIN jobs j ON i.job_id = j.id
      WHERE i.id = ${id}
      AND om.user_id = ${user.id}
      AND om.status = 'active'
      LIMIT 1
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoices[0]

    // Get organization details
    const organizations = await sql`
      SELECT * FROM organizations WHERE id = ${invoice.organization_id} LIMIT 1
    `
    const organization = organizations[0]

    // Get line items
    const lineItems = await sql`
      SELECT * FROM invoice_line_items
      WHERE invoice_id = ${id}
      ORDER BY line_order ASC
    `

    // Generate PDF
    const pdfData = {
      invoice,
      lineItems,
      organization,
    } as any // Type assertion to bypass strict typing from database queries

    const pdfStream = generateInvoicePDF(pdfData)

    // Convert stream to buffer
    const chunks: Buffer[] = []
    pdfStream.on('data', (chunk) => chunks.push(chunk))

    await new Promise<void>((resolve, reject) => {
      pdfStream.on('end', () => resolve())
      pdfStream.on('error', reject)
    })

    const buffer = Buffer.concat(chunks)

    // Return PDF with proper headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
