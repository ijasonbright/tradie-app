import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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
    public_token: string | null
    stripe_payment_link_url: string | null
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
    logo_url: string | null
    primary_color: string | null
  }
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const { invoice, lineItems, organization } = data

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size in points

  // Load fonts
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Parse brand color or use default
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? rgb(
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255
        )
      : rgb(0.15, 0.39, 0.92) // Default blue
  }

  const primaryColor = organization.primary_color
    ? hexToRgb(organization.primary_color)
    : rgb(0.15, 0.39, 0.92) // Default blue #2563eb
  const textColor = rgb(0.12, 0.16, 0.22) // Dark gray
  const lightGray = rgb(0.42, 0.45, 0.50)
  const veryLightGray = rgb(0.98, 0.98, 0.99)

  // Load logo if available
  let logoImage = null
  let logoWidth = 0
  let logoHeight = 0
  if (organization.logo_url) {
    try {
      const logoResponse = await fetch(organization.logo_url)
      const logoBytes = await logoResponse.arrayBuffer()
      const logoExt = organization.logo_url.toLowerCase()

      if (logoExt.includes('.png')) {
        logoImage = await pdfDoc.embedPng(logoBytes)
      } else if (logoExt.includes('.jpg') || logoExt.includes('.jpeg')) {
        logoImage = await pdfDoc.embedJpg(logoBytes)
      }

      if (logoImage) {
        const logoDims = logoImage.scale(0.3)
        logoWidth = Math.min(logoDims.width, 150)
        logoHeight = logoWidth * (logoImage.height / logoImage.width)
      }
    } catch (error) {
      console.error('Failed to load logo for PDF:', error)
    }
  }

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

  const { width, height } = page.getSize()
  let yPosition = height - 50

  // Header - Logo (if available)
  if (logoImage) {
    page.drawImage(logoImage, {
      x: 50,
      y: yPosition - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
    yPosition -= logoHeight + 20
  }

  // Header - Company Name
  page.drawText(organization.name, {
    x: 50,
    y: yPosition,
    size: logoImage ? 18 : 24, // Smaller if logo is present
    font: boldFont,
    color: primaryColor,
  })
  yPosition -= 30

  // Company details
  const companyDetails = []
  if (organization.abn) companyDetails.push(`ABN: ${organization.abn}`)
  if (organization.address_line1) companyDetails.push(organization.address_line1)
  if (organization.city || organization.state || organization.postcode) {
    companyDetails.push([organization.city, organization.state, organization.postcode].filter(Boolean).join(', '))
  }
  if (organization.email) companyDetails.push(`Email: ${organization.email}`)
  if (organization.phone) companyDetails.push(`Phone: ${organization.phone}`)

  companyDetails.forEach((detail) => {
    page.drawText(detail, {
      x: 50,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
    yPosition -= 15
  })

  // Invoice Title
  yPosition -= 20
  page.drawText('INVOICE', {
    x: 50,
    y: yPosition,
    size: 28,
    font: boldFont,
    color: textColor,
  })

  // Invoice details (right side)
  const rightX = 400
  let rightY = height - 120

  page.drawText('Invoice Number:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  page.drawText(invoice.invoice_number, {
    x: rightX,
    y: rightY - 15,
    size: 10,
    font: boldFont,
    color: textColor,
  })

  rightY -= 45
  page.drawText('Issue Date:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  page.drawText(formatDate(invoice.issue_date), {
    x: rightX,
    y: rightY - 15,
    size: 10,
    font: regularFont,
    color: textColor,
  })

  rightY -= 45
  page.drawText('Due Date:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  page.drawText(formatDate(invoice.due_date), {
    x: rightX,
    y: rightY - 15,
    size: 10,
    font: regularFont,
    color: textColor,
  })

  // Bill To section
  yPosition -= 80
  page.drawText('BILL TO', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: primaryColor,
  })
  yPosition -= 20

  const clientName = invoice.is_company && invoice.company_name
    ? invoice.company_name
    : `${invoice.first_name} ${invoice.last_name}`

  page.drawText(clientName, {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont,
    color: textColor,
  })
  yPosition -= 18

  const billingDetails = []
  if (invoice.billing_address_line1) billingDetails.push(invoice.billing_address_line1)
  if (invoice.billing_city || invoice.billing_state || invoice.billing_postcode) {
    billingDetails.push([invoice.billing_city, invoice.billing_state, invoice.billing_postcode].filter(Boolean).join(', '))
  }
  if (invoice.email) billingDetails.push(`Email: ${invoice.email}`)

  billingDetails.forEach((detail) => {
    page.drawText(detail, {
      x: 50,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
    yPosition -= 15
  })

  // Line items table
  yPosition -= 30
  const tableTop = yPosition

  // Table header background
  page.drawRectangle({
    x: 50,
    y: tableTop - 25,
    width: 495,
    height: 25,
    color: primaryColor,
  })

  // Table header text
  page.drawText('Description', {
    x: 55,
    y: tableTop - 17,
    size: 10,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  page.drawText('Qty', {
    x: 360,
    y: tableTop - 17,
    size: 10,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  page.drawText('Price', {
    x: 415,
    y: tableTop - 17,
    size: 10,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  page.drawText('Total', {
    x: 490,
    y: tableTop - 17,
    size: 10,
    font: boldFont,
    color: rgb(1, 1, 1),
  })

  yPosition = tableTop - 25

  // Line items
  lineItems.forEach((item, index) => {
    const rowHeight = 30
    yPosition -= rowHeight

    // Alternating row background
    if (index % 2 === 0) {
      page.drawRectangle({
        x: 50,
        y: yPosition,
        width: 495,
        height: rowHeight,
        color: veryLightGray,
      })
    }

    // Truncate description if too long
    const maxDescLength = 40
    const description = item.description.length > maxDescLength
      ? item.description.substring(0, maxDescLength) + '...'
      : item.description

    page.drawText(description, {
      x: 55,
      y: yPosition + 10,
      size: 9,
      font: regularFont,
      color: textColor,
    })

    page.drawText(item.quantity, {
      x: 365,
      y: yPosition + 10,
      size: 9,
      font: regularFont,
      color: textColor,
    })

    page.drawText(formatCurrency(item.unit_price), {
      x: 415,
      y: yPosition + 10,
      size: 9,
      font: regularFont,
      color: textColor,
    })

    const totalText = formatCurrency(item.line_total)
    const totalWidth = regularFont.widthOfTextAtSize(totalText, 9)
    page.drawText(totalText, {
      x: 540 - totalWidth,
      y: yPosition + 10,
      size: 9,
      font: regularFont,
      color: textColor,
    })
  })

  // Totals section
  yPosition -= 40
  const totalsX = 400

  // Subtotal
  page.drawText('Subtotal:', {
    x: totalsX,
    y: yPosition,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  const subtotalText = formatCurrency(invoice.subtotal)
  const subtotalWidth = regularFont.widthOfTextAtSize(subtotalText, 10)
  page.drawText(subtotalText, {
    x: 540 - subtotalWidth,
    y: yPosition,
    size: 10,
    font: regularFont,
    color: textColor,
  })
  yPosition -= 20

  // GST
  page.drawText('GST (10%):', {
    x: totalsX,
    y: yPosition,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  const gstText = formatCurrency(invoice.gst_amount)
  const gstWidth = regularFont.widthOfTextAtSize(gstText, 10)
  page.drawText(gstText, {
    x: 540 - gstWidth,
    y: yPosition,
    size: 10,
    font: regularFont,
    color: textColor,
  })
  yPosition -= 30

  // Total
  page.drawRectangle({
    x: totalsX,
    y: yPosition - 5,
    width: 145,
    height: 30,
    color: primaryColor,
  })
  page.drawText('TOTAL:', {
    x: totalsX + 10,
    y: yPosition + 5,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  const totalText = formatCurrency(invoice.total_amount)
  const totalWidth = boldFont.widthOfTextAtSize(totalText, 12)
  page.drawText(totalText, {
    x: 540 - totalWidth - 5,
    y: yPosition + 5,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  })
  yPosition -= 40

  // Paid amount and outstanding
  const paidAmount = parseFloat(invoice.paid_amount || '0')
  const totalAmount = parseFloat(invoice.total_amount)
  const outstanding = totalAmount - paidAmount

  if (paidAmount > 0) {
    page.drawText('Paid:', {
      x: totalsX,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
    const paidText = formatCurrency(invoice.paid_amount)
    const paidWidth = regularFont.widthOfTextAtSize(paidText, 10)
    page.drawText(paidText, {
      x: 540 - paidWidth,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: rgb(0.02, 0.59, 0.41), // Green
    })
    yPosition -= 20

    page.drawText('Outstanding:', {
      x: totalsX,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
    const outstandingText = formatCurrency(outstanding.toFixed(2))
    const outstandingWidth = regularFont.widthOfTextAtSize(outstandingText, 10)
    page.drawText(outstandingText, {
      x: 540 - outstandingWidth,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: rgb(0.86, 0.15, 0.15), // Red
    })
    yPosition -= 30
  }

  // Payment instructions and Pay Online section (side by side)
  const hasPaymentLink = outstanding > 0 && invoice.public_token
  const hasBankDetails = organization.bank_name && organization.bank_bsb && organization.bank_account_number

  if (hasBankDetails || hasPaymentLink) {
    yPosition -= 20
    const startYPosition = yPosition

    // Left side: Bank details
    if (hasBankDetails) {
      page.drawText('Payment Instructions', {
        x: 50,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: primaryColor,
      })
      yPosition -= 20

      const paymentDetails = []
      if (organization.bank_account_name) {
        paymentDetails.push(`Account Name: ${organization.bank_account_name}`)
      }
      paymentDetails.push(`Bank: ${organization.bank_name}`)
      paymentDetails.push(`BSB: ${organization.bank_bsb}`)
      paymentDetails.push(`Account Number: ${organization.bank_account_number}`)

      paymentDetails.forEach((detail) => {
        page.drawText(detail, {
          x: 50,
          y: yPosition,
          size: 10,
          font: regularFont,
          color: textColor,
        })
        yPosition -= 15
      })
    }

    // Right side: Pay Online section (inline with bank details)
    if (hasPaymentLink) {
      const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tradie-app-web.vercel.app'}/public/invoices/${invoice.public_token}`
      let rightYPosition = startYPosition

      // "Pay Online" heading on right side
      page.drawText('Pay Online', {
        x: 320,
        y: rightYPosition,
        size: 12,
        font: boldFont,
        color: primaryColor,
      })
      rightYPosition -= 20

      // Payment instructions
      page.drawText('Pay securely with card:', {
        x: 320,
        y: rightYPosition,
        size: 10,
        font: regularFont,
        color: textColor,
      })
      rightYPosition -= 25

      // Draw payment button background
      const buttonWidth = 180
      const buttonHeight = 35
      const buttonX = 320
      const buttonY = rightYPosition - buttonHeight + 5

      page.drawRectangle({
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight,
        color: primaryColor,
      })

      // "Pay Now" button text
      const buttonText = 'Pay Now'
      const buttonTextSize = 12
      const buttonTextWidth = boldFont.widthOfTextAtSize(buttonText, buttonTextSize)
      page.drawText(buttonText, {
        x: buttonX + (buttonWidth - buttonTextWidth) / 2,
        y: buttonY + (buttonHeight - buttonTextSize) / 2 + 2,
        size: buttonTextSize,
        font: boldFont,
        color: rgb(1, 1, 1), // White
      })

      rightYPosition -= buttonHeight + 10

      // Small URL text below button (compact)
      const urlText = 'Visit payment link:'
      page.drawText(urlText, {
        x: 320,
        y: rightYPosition,
        size: 7,
        font: regularFont,
        color: lightGray,
      })
      rightYPosition -= 10

      // Split URL into multiple lines if needed (to fit in right column)
      const maxUrlWidth = 220
      const urlSize = 7
      const urlParts = []
      let currentPart = ''

      for (let i = 0; i < paymentUrl.length; i++) {
        const char = paymentUrl[i]
        const testPart = currentPart + char
        const testWidth = regularFont.widthOfTextAtSize(testPart, urlSize)

        if (testWidth > maxUrlWidth && currentPart) {
          urlParts.push(currentPart)
          currentPart = char
        } else {
          currentPart = testPart
        }
      }
      if (currentPart) {
        urlParts.push(currentPart)
      }

      urlParts.forEach((part) => {
        page.drawText(part, {
          x: 320,
          y: rightYPosition,
          size: urlSize,
          font: regularFont,
          color: primaryColor,
        })
        rightYPosition -= 9
      })

      // Update yPosition to the lower of the two columns
      yPosition = Math.min(yPosition, rightYPosition)
    }
  }

  // Payment terms
  if (invoice.payment_terms) {
    yPosition -= 20
    page.drawText(`Payment Terms: ${invoice.payment_terms}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
  }

  // Notes
  if (invoice.notes && yPosition > 100) {
    yPosition -= 20
    page.drawText('Notes', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: primaryColor,
    })
    yPosition -= 15

    // Split notes into lines if too long
    const maxWidth = 495
    const words = invoice.notes.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = regularFont.widthOfTextAtSize(testLine, 10)

      if (textWidth > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: 50,
          y: yPosition,
          size: 10,
          font: regularFont,
          color: textColor,
        })
        yPosition -= 15
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: 50,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: textColor,
      })
    }
  }


  // Footer
  if (invoice.footer_text) {
    const footerY = Math.min(50, yPosition - 20)
    const footerWidth = regularFont.widthOfTextAtSize(invoice.footer_text, 9)
    page.drawText(invoice.footer_text, {
      x: (width - footerWidth) / 2,
      y: footerY,
      size: 9,
      font: regularFont,
      color: lightGray,
    })
  }

  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
