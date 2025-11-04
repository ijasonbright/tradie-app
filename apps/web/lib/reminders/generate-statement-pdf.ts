interface GenerateStatementPdfParams {
  client: any
  invoices: any[]
  organization: any
  totalOutstanding: number
  aging: {
    current: number
    days30: number
    days60: number
    days90: number
    days90Plus: number
  }
  statementDate: Date
}

/**
 * Generate a PDF statement for a client
 *
 * TODO: Implement PDF generation using one of these libraries:
 * - Puppeteer (headless Chrome)
 * - PDFKit (low-level PDF generation)
 * - React-PDF (React components to PDF)
 * - jsPDF (client-side PDF generation)
 *
 * Recommended: Puppeteer for high-quality, HTML-based PDFs
 */
export async function generateStatementPdf({
  client,
  invoices,
  organization,
  totalOutstanding,
  aging,
  statementDate,
}: GenerateStatementPdfParams): Promise<Buffer> {
  console.log('[PDF] Generating statement PDF:', {
    clientId: client.id,
    organizationId: organization.id,
    invoiceCount: invoices.length,
  })

  // TODO: Implement actual PDF generation
  // For now, return a placeholder buffer
  const placeholder = `
MONTHLY STATEMENT
${organization.name}
${statementDate.toLocaleDateString('en-AU')}

Client: ${client.firstName || client.companyName || 'Client'}
Total Outstanding: $${totalOutstanding.toFixed(2)}

Invoices (${invoices.length}):
${invoices.map(inv => `
  - Invoice #${inv.invoiceNumber}
    Date: ${new Date(inv.issueDate).toLocaleDateString('en-AU')}
    Due: ${new Date(inv.dueDate).toLocaleDateString('en-AU')}
    Amount: $${inv.totalAmount}
    Status: ${inv.status}
`).join('')}

Aging Summary:
- Current: $${aging.current.toFixed(2)}
- 1-30 days: $${aging.days30.toFixed(2)}
- 31-60 days: $${aging.days60.toFixed(2)}
- 61-90 days: $${aging.days90.toFixed(2)}
- 90+ days: $${aging.days90Plus.toFixed(2)}
`

  return Buffer.from(placeholder, 'utf-8')

  /* Example implementation with Puppeteer:

  import puppeteer from 'puppeteer'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { max-height: 80px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #f3f4f6; padding: 10px; text-align: left; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          .summary { background-color: #f9fafb; padding: 20px; margin: 20px 0; }
          .total { font-size: 18px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          ${organization.logoUrl ? `<img src="${organization.logoUrl}" class="logo" />` : ''}
          <h1>${organization.name}</h1>
          <p>${organization.addressLine1}<br>${organization.city}, ${organization.state} ${organization.postcode}</p>
          <p>Phone: ${organization.phone} | Email: ${organization.email}</p>
        </div>

        <h2>MONTHLY STATEMENT</h2>
        <p><strong>Statement Date:</strong> ${statementDate.toLocaleDateString('en-AU')}</p>
        <p><strong>Client:</strong> ${client.firstName || client.companyName}<br>
        ${client.siteAddressLine1}<br>
        ${client.siteCity}, ${client.siteState} ${client.sitePostcode}</p>

        <div class="summary">
          <h3>Account Summary</h3>
          <p><strong>Total Outstanding:</strong> <span class="total">$${totalOutstanding.toFixed(2)}</span></p>

          <h4>Aging Report</h4>
          <table>
            <tr>
              <th>Period</th>
              <th style="text-align: right;">Amount</th>
            </tr>
            <tr><td>Current</td><td style="text-align: right;">$${aging.current.toFixed(2)}</td></tr>
            <tr><td>1-30 days</td><td style="text-align: right;">$${aging.days30.toFixed(2)}</td></tr>
            <tr><td>31-60 days</td><td style="text-align: right;">$${aging.days60.toFixed(2)}</td></tr>
            <tr><td>61-90 days</td><td style="text-align: right;">$${aging.days90.toFixed(2)}</td></tr>
            <tr><td>90+ days</td><td style="text-align: right;">$${aging.days90Plus.toFixed(2)}</td></tr>
          </table>
        </div>

        <h3>Invoice Details</h3>
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Due Date</th>
              <th style="text-align: right;">Amount</th>
              <th style="text-align: right;">Paid</th>
              <th style="text-align: right;">Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map(inv => {
              const total = parseFloat(inv.totalAmount)
              const paid = parseFloat(inv.paidAmount || '0')
              const balance = total - paid
              return `
                <tr>
                  <td>${inv.invoiceNumber}</td>
                  <td>${new Date(inv.issueDate).toLocaleDateString('en-AU')}</td>
                  <td>${new Date(inv.dueDate).toLocaleDateString('en-AU')}</td>
                  <td style="text-align: right;">$${total.toFixed(2)}</td>
                  <td style="text-align: right;">$${paid.toFixed(2)}</td>
                  <td style="text-align: right;">$${balance.toFixed(2)}</td>
                  <td>${inv.status}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        ${organization.bankAccountNumber ? `
        <div style="margin-top: 40px; padding: 20px; border: 2px solid #ddd;">
          <h3>Payment Details</h3>
          <p><strong>Account Name:</strong> ${organization.bankAccountName || organization.name}<br>
          <strong>BSB:</strong> ${organization.bankBsb}<br>
          <strong>Account Number:</strong> ${organization.bankAccountNumber}<br>
          <em>Please use your invoice number as payment reference</em></p>
        </div>
        ` : ''}
      </body>
    </html>
  `

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(html)
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm',
    },
  })
  await browser.close()

  return pdfBuffer
  */
}
