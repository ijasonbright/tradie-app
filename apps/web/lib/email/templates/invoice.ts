interface InvoiceEmailData {
  invoiceNumber: string
  clientName: string
  organizationName: string
  totalAmount: string
  dueDate: string
  organizationEmail?: string
  organizationPhone?: string
  logoUrl?: string
  primaryColor?: string
  bankName?: string
  bankBsb?: string
  bankAccountNumber?: string
  bankAccountName?: string
  paymentLink?: string
}

export function generateInvoiceEmailHTML(data: InvoiceEmailData): string {
  const { invoiceNumber, clientName, organizationName, totalAmount, dueDate, organizationEmail, organizationPhone, logoUrl, primaryColor, bankName, bankBsb, bankAccountNumber, bankAccountName, paymentLink } = data
  const brandColor = primaryColor || '#2563eb'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 30px; text-align: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${organizationName}" style="max-width: 200px; max-height: 60px; margin-bottom: 20px; object-fit: contain;">` : ''}
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Invoice</h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">${invoiceNumber}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Dear ${clientName},</p>

              <p style="margin: 0 0 20px 0; font-size: 16px; color: #555; line-height: 1.6;">
                Thank you for your business! Please find attached your invoice from <strong>${organizationName}</strong>.
              </p>

              <!-- Invoice Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">Invoice Number:</td>
                        <td align="right" style="color: #333; font-size: 14px; font-weight: bold;">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Total Amount:</td>
                        <td align="right" style="color: ${brandColor}; font-size: 18px; font-weight: bold;">${totalAmount}</td>
                      </tr>
                      <tr>
                        <td style="color: #666; font-size: 14px;">Due Date:</td>
                        <td align="right" style="color: #333; font-size: 14px; font-weight: bold;">${dueDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 20px 0; font-size: 16px; color: #555; line-height: 1.6;">
                The attached PDF contains full details of the invoice, including itemized charges and payment instructions.
              </p>

              <p style="margin: 0 0 10px 0; font-size: 16px; color: #555; line-height: 1.6;">
                If you have any questions about this invoice, please don't hesitate to contact us.
              </p>

              ${paymentLink ? `
              <!-- Payment Link Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${paymentLink}" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                      Pay Invoice Online
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${bankName || bankBsb || bankAccountNumber ? `
              <!-- Banking Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid ${brandColor};">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #666; font-weight: bold;">Payment Details:</p>
                    ${bankAccountName ? `<p style="margin: 0 0 5px 0; font-size: 14px; color: #333;"><strong>Account Name:</strong> ${bankAccountName}</p>` : ''}
                    ${bankName ? `<p style="margin: 0 0 5px 0; font-size: 14px; color: #333;"><strong>Bank:</strong> ${bankName}</p>` : ''}
                    ${bankBsb ? `<p style="margin: 0 0 5px 0; font-size: 14px; color: #333;"><strong>BSB:</strong> ${bankBsb}</p>` : ''}
                    ${bankAccountNumber ? `<p style="margin: 0; font-size: 14px; color: #333;"><strong>Account Number:</strong> ${bankAccountNumber}</p>` : ''}
                  </td>
                </tr>
              </table>
              ` : ''}

              ${organizationEmail || organizationPhone ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 6px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #666; font-weight: bold;">Contact Us:</p>
                    ${organizationEmail ? `<p style="margin: 0 0 5px 0; font-size: 14px; color: #555;">Email: ${organizationEmail}</p>` : ''}
                    ${organizationPhone ? `<p style="margin: 0; font-size: 14px; color: #555;">Phone: ${organizationPhone}</p>` : ''}
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 30px 0 0 0; font-size: 16px; color: #555;">
                Thank you,<br>
                <strong>${organizationName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #999;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

export function generateInvoiceEmailText(data: InvoiceEmailData): string {
  const { invoiceNumber, clientName, organizationName, totalAmount, dueDate, paymentLink } = data

  return `
Dear ${clientName},

Thank you for your business! Please find attached your invoice from ${organizationName}.

Invoice Details:
- Invoice Number: ${invoiceNumber}
- Total Amount: ${totalAmount}
- Due Date: ${dueDate}

The attached PDF contains full details of the invoice, including itemized charges and payment instructions.

${paymentLink ? `Pay Online: ${paymentLink}\n` : ''}
If you have any questions about this invoice, please don't hesitate to contact us.

Thank you,
${organizationName}

---
This is an automated message. Please do not reply directly to this email.
  `.trim()
}
