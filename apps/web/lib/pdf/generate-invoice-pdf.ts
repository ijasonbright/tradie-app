import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

interface InvoiceLineItem {
  description: string
  quantity: string
  unit_price: string
  line_total: string
  gst_amount: string
}

interface InvoiceData {
  invoice: {
    invoice_number: string
    issue_date: string
    due_date: string
    status: string
    subtotal: string
    gst_amount: string
    total_amount: string
    paid_amount: string
    payment_terms: string | null
    notes: string | null
    footer_text: string | null
    // Client info from JOIN
    is_company: boolean
    company_name: string | null
    first_name: string
    last_name: string
    email: string
    phone: string | null
    billing_address_line1: string | null
    billing_city: string | null
    billing_state: string | null
    billing_postcode: string | null
  }
  lineItems: InvoiceLineItem[]
  organization: {
    name: string
    abn: string | null
    email: string | null
    phone: string | null
    address_line1: string | null
    city: string | null
    state: string | null
    postcode: string | null
    bank_name: string | null
    bank_bsb: string | null
    bank_account_number: string | null
    bank_account_name: string | null
  }
}

export function generateInvoicePDF(data: InvoiceData): Readable {
  const { invoice, lineItems, organization } = data

  // Create PDF document
  const doc = new PDFDocument({ size: 'A4', margin: 50 })

  // Colors
  const primaryColor = '#2563eb' // Blue
  const textColor = '#1f2937' // Dark gray
  const lightGray = '#6b7280'
  const borderColor = '#e5e7eb'

  // Helper function to format currency
  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount)
    return `$${num.toFixed(2)}`
  }

  // Helper to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  let yPosition = 50

  // Header - Company Name
  doc.fontSize(24).fillColor(primaryColor).text(organization.name, 50, yPosition)
  yPosition += 30

  // Company details
  doc.fontSize(10).fillColor(lightGray)
  if (organization.abn) {
    doc.text(`ABN: ${organization.abn}`, 50, yPosition)
    yPosition += 15
  }
  if (organization.address_line1) {
    doc.text(organization.address_line1, 50, yPosition)
    yPosition += 15
  }
  if (organization.city || organization.state || organization.postcode) {
    const addressLine2 = [organization.city, organization.state, organization.postcode]
      .filter(Boolean)
      .join(', ')
    doc.text(addressLine2, 50, yPosition)
    yPosition += 15
  }
  if (organization.email) {
    doc.text(`Email: ${organization.email}`, 50, yPosition)
    yPosition += 15
  }
  if (organization.phone) {
    doc.text(`Phone: ${organization.phone}`, 50, yPosition)
    yPosition += 15
  }

  // Invoice Title
  yPosition += 20
  doc.fontSize(28).fillColor(textColor).text('INVOICE', 50, yPosition)

  // Invoice number and dates (right side)
  const rightX = 400
  let rightY = 120
  doc.fontSize(10).fillColor(lightGray)
  doc.text('Invoice Number:', rightX, rightY, { width: 145, align: 'right' })
  doc.fillColor(textColor).text(invoice.invoice_number, rightX, rightY + 15, { width: 145, align: 'right' })

  rightY += 45
  doc.fillColor(lightGray).text('Issue Date:', rightX, rightY, { width: 145, align: 'right' })
  doc.fillColor(textColor).text(formatDate(invoice.issue_date), rightX, rightY + 15, { width: 145, align: 'right' })

  rightY += 45
  doc.fillColor(lightGray).text('Due Date:', rightX, rightY, { width: 145, align: 'right' })
  doc.fillColor(textColor).text(formatDate(invoice.due_date), rightX, rightY + 15, { width: 145, align: 'right' })

  // Bill To section
  yPosition += 80
  doc.fontSize(12).fillColor(primaryColor).text('BILL TO', 50, yPosition)
  yPosition += 20

  doc.fontSize(11).fillColor(textColor)
  const clientName = invoice.is_company && invoice.company_name
    ? invoice.company_name
    : `${invoice.first_name} ${invoice.last_name}`
  doc.text(clientName, 50, yPosition)
  yPosition += 18

  doc.fontSize(10).fillColor(lightGray)
  if (invoice.billing_address_line1) {
    doc.text(invoice.billing_address_line1, 50, yPosition)
    yPosition += 15
  }
  if (invoice.billing_city || invoice.billing_state || invoice.billing_postcode) {
    const billingLine2 = [invoice.billing_city, invoice.billing_state, invoice.billing_postcode]
      .filter(Boolean)
      .join(', ')
    doc.text(billingLine2, 50, yPosition)
    yPosition += 15
  }
  if (invoice.email) {
    doc.text(`Email: ${invoice.email}`, 50, yPosition)
    yPosition += 15
  }

  // Line items table
  yPosition += 30
  const tableTop = yPosition
  const itemX = 50
  const qtyX = 300
  const priceX = 370
  const totalX = 470

  // Table header
  doc.fontSize(10).fillColor('#ffffff')
  doc.rect(50, tableTop, 495, 25).fill(primaryColor)

  doc.text('Description', itemX + 5, tableTop + 8, { width: 240 })
  doc.text('Qty', qtyX + 5, tableTop + 8, { width: 50, align: 'right' })
  doc.text('Price', priceX + 5, tableTop + 8, { width: 80, align: 'right' })
  doc.text('Total', totalX + 5, tableTop + 8, { width: 65, align: 'right' })

  yPosition = tableTop + 25

  // Line items
  doc.fontSize(9).fillColor(textColor)
  lineItems.forEach((item, index) => {
    const rowHeight = 30

    // Alternating row background
    if (index % 2 === 0) {
      doc.rect(50, yPosition, 495, rowHeight).fill('#f9fafb')
    }

    doc.fillColor(textColor)
    doc.text(item.description, itemX + 5, yPosition + 8, { width: 240 })
    doc.text(item.quantity, qtyX + 5, yPosition + 8, { width: 50, align: 'right' })
    doc.text(formatCurrency(item.unit_price), priceX + 5, yPosition + 8, { width: 80, align: 'right' })
    doc.text(formatCurrency(item.line_total), totalX + 5, yPosition + 8, { width: 65, align: 'right' })

    yPosition += rowHeight
  })

  // Totals section
  yPosition += 20
  const totalsX = 370

  doc.fontSize(10).fillColor(lightGray)
  doc.text('Subtotal:', totalsX, yPosition, { width: 80, align: 'right' })
  doc.fillColor(textColor).text(formatCurrency(invoice.subtotal), totalsX + 90, yPosition, { width: 80, align: 'right' })
  yPosition += 20

  doc.fillColor(lightGray).text('GST (10%):', totalsX, yPosition, { width: 80, align: 'right' })
  doc.fillColor(textColor).text(formatCurrency(invoice.gst_amount), totalsX + 90, yPosition, { width: 80, align: 'right' })
  yPosition += 20

  // Total line
  doc.rect(totalsX, yPosition - 5, 175, 30).fill(primaryColor)
  doc.fontSize(12).fillColor('#ffffff')
  doc.text('TOTAL:', totalsX + 10, yPosition + 5, { width: 70, align: 'right' })
  doc.text(formatCurrency(invoice.total_amount), totalsX + 90, yPosition + 5, { width: 75, align: 'right' })
  yPosition += 40

  // Paid amount and outstanding
  const paidAmount = parseFloat(invoice.paid_amount || '0')
  const totalAmount = parseFloat(invoice.total_amount)
  const outstanding = totalAmount - paidAmount

  if (paidAmount > 0) {
    doc.fontSize(10).fillColor(lightGray)
    doc.text('Paid:', totalsX, yPosition, { width: 80, align: 'right' })
    doc.fillColor('#059669').text(formatCurrency(invoice.paid_amount), totalsX + 90, yPosition, { width: 80, align: 'right' })
    yPosition += 20

    doc.fillColor(lightGray).text('Outstanding:', totalsX, yPosition, { width: 80, align: 'right' })
    doc.fillColor('#dc2626').text(formatCurrency(outstanding.toFixed(2)), totalsX + 90, yPosition, { width: 80, align: 'right' })
    yPosition += 30
  }

  // Payment instructions
  if (organization.bank_name && organization.bank_bsb && organization.bank_account_number) {
    yPosition += 20
    doc.fontSize(12).fillColor(primaryColor).text('Payment Instructions', 50, yPosition)
    yPosition += 20

    doc.fontSize(10).fillColor(textColor)
    doc.text(`Bank: ${organization.bank_name}`, 50, yPosition)
    yPosition += 15
    doc.text(`BSB: ${organization.bank_bsb}`, 50, yPosition)
    yPosition += 15
    doc.text(`Account Number: ${organization.bank_account_number}`, 50, yPosition)
    yPosition += 15
    if (organization.bank_account_name) {
      doc.text(`Account Name: ${organization.bank_account_name}`, 50, yPosition)
      yPosition += 15
    }
  }

  // Payment terms
  if (invoice.payment_terms) {
    yPosition += 20
    doc.fontSize(10).fillColor(lightGray).text(`Payment Terms: ${invoice.payment_terms}`, 50, yPosition)
    yPosition += 15
  }

  // Notes
  if (invoice.notes) {
    yPosition += 20
    doc.fontSize(12).fillColor(primaryColor).text('Notes', 50, yPosition)
    yPosition += 15
    doc.fontSize(10).fillColor(textColor).text(invoice.notes, 50, yPosition, { width: 495 })
  }

  // Footer
  if (invoice.footer_text) {
    doc.fontSize(9).fillColor(lightGray)
    doc.text(invoice.footer_text, 50, 750, { width: 495, align: 'center' })
  }

  // Finalize PDF
  doc.end()

  // PDFDocument is a Readable stream
  return doc as unknown as Readable
}
