interface CompletionFormData {
  form: {
    id: string
    template_id: string
    completed_date: string
    completed_by_user_id: string
    form_data: any
    client_signature_url?: string
    technician_signature_url?: string
  }
  job: {
    id: string
    job_number: string
    title: string
    client_id: string
    site_address_line1?: string
    site_address_line2?: string
    site_city?: string
    site_state?: string
    site_postcode?: string
    completed_at?: string
  }
  client: {
    company_name?: string
    first_name: string
    last_name: string
    email?: string
    phone?: string
  }
  organization: {
    name: string
    logo_url?: string
    phone?: string
    email?: string
    abn?: string
    address_line1?: string
    address_line2?: string
    city?: string
    state?: string
    postcode?: string
  }
  template: {
    name: string
    description?: string
  }
  groups: Array<{
    id: string
    group_name: string
    description?: string
    questions: Array<{
      id: string
      question_text: string
      field_type: string
      answer?: any
      photos?: Array<{
        photo_url: string
        caption?: string
      }>
    }>
  }>
  completedBy: {
    full_name: string
    email: string
  }
  photos: Array<{
    photo_url: string
    caption?: string
    photo_type: string
  }>
}

export async function generateCompletionFormPDF(data: CompletionFormData): Promise<Buffer> {
  const html = generateHTML(data)

  let browser = null
  try {
    // Dynamically load packages based on environment
    const isVercel = !!process.env.VERCEL
    let puppeteer: any
    let launchOptions: any = {
      headless: true,
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
    }

    if (isVercel) {
      // Production (Vercel) - use @sparticuz/chromium
      const chromium = (await import('@sparticuz/chromium')).default
      puppeteer = await import('puppeteer-core')
      launchOptions = {
        ...launchOptions,
        args: chromium.args,
        executablePath: await chromium.executablePath(),
      }
    } else {
      // Local development - use full puppeteer
      puppeteer = await import('puppeteer')
    }

    browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    })

    return Buffer.from(pdf)
  } catch (error) {
    console.error('PDF generation error:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

function generateHTML(data: CompletionFormData): string {
  const clientName = data.client.company_name || `${data.client.first_name} ${data.client.last_name}`
  const address = [
    data.job.site_address_line1,
    data.job.site_address_line2,
    data.job.site_city,
    data.job.site_state,
    data.job.site_postcode,
  ]
    .filter(Boolean)
    .join(', ')

  const completedDate = new Date(data.form.completed_date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.template.name} - ${data.job.job_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }

    .logo-section {
      flex: 1;
    }

    .logo {
      max-width: 200px;
      max-height: 80px;
      margin-bottom: 10px;
    }

    .company-info {
      font-size: 9pt;
      color: #666;
      line-height: 1.4;
    }

    .report-title-section {
      text-align: right;
      flex: 1;
    }

    .report-type {
      font-size: 10pt;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }

    .report-title {
      font-size: 18pt;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }

    .job-number {
      font-size: 10pt;
      color: #666;
      margin-bottom: 5px;
    }

    .report-date {
      font-size: 9pt;
      color: #999;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .info-block {
      margin-bottom: 10px;
    }

    .info-label {
      font-size: 9pt;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 11pt;
      color: #111;
      font-weight: 500;
    }

    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .section-header {
      background: #2563eb;
      color: white;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: 6px;
      font-size: 13pt;
      font-weight: 600;
    }

    .section-description {
      font-size: 10pt;
      color: #666;
      font-style: italic;
      margin-bottom: 20px;
      padding-left: 16px;
    }

    .question {
      margin-bottom: 25px;
      padding-left: 16px;
      page-break-inside: avoid;
    }

    .question-text {
      font-size: 11pt;
      font-weight: 600;
      color: #111;
      margin-bottom: 8px;
    }

    .question-type {
      font-size: 8pt;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .answer {
      font-size: 11pt;
      color: #444;
      padding: 12px;
      background: #ffffff;
      border-left: 3px solid #2563eb;
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .answer-checkbox {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      background: #f0f9ff;
      border-radius: 4px;
      margin-right: 8px;
      margin-bottom: 8px;
    }

    .answer-checkbox.checked {
      background: #dbeafe;
      border: 1px solid #2563eb;
    }

    .checkbox-icon {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #2563eb;
      border-radius: 3px;
      margin-right: 6px;
      background: #2563eb;
      position: relative;
    }

    .checkbox-icon::after {
      content: '✓';
      position: absolute;
      top: -2px;
      left: 2px;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 12px;
    }

    .photo-container {
      page-break-inside: avoid;
    }

    .photo {
      width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .photo-caption {
      font-size: 9pt;
      color: #666;
      margin-top: 6px;
      font-style: italic;
    }

    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 40px;
      padding-top: 30px;
      border-top: 2px solid #e5e7eb;
      page-break-inside: avoid;
    }

    .signature-box {
      text-align: center;
    }

    .signature-label {
      font-size: 10pt;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .signature-image {
      max-width: 200px;
      max-height: 80px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 10px;
      background: white;
      margin: 0 auto 10px;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin: 0 auto 5px;
      width: 250px;
    }

    .signature-name {
      font-size: 10pt;
      color: #111;
      font-weight: 600;
    }

    .signature-date {
      font-size: 9pt;
      color: #666;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #999;
    }

    .no-answer {
      color: #999;
      font-style: italic;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="logo-section">
      ${
        data.organization.logo_url
          ? `<img src="${data.organization.logo_url}" alt="${data.organization.name}" class="logo">`
          : `<h2 style="color: #2563eb; margin-bottom: 10px;">${data.organization.name}</h2>`
      }
      <div class="company-info">
        ${data.organization.abn ? `<div>ABN: ${data.organization.abn}</div>` : ''}
        ${data.organization.phone ? `<div>Phone: ${data.organization.phone}</div>` : ''}
        ${data.organization.email ? `<div>Email: ${data.organization.email}</div>` : ''}
        ${
          data.organization.address_line1
            ? `<div>${[data.organization.address_line1, data.organization.city, data.organization.state, data.organization.postcode].filter(Boolean).join(', ')}</div>`
            : ''
        }
      </div>
    </div>
    <div class="report-title-section">
      <div class="report-type">Job Completion Report</div>
      <div class="report-title">${data.template.name}</div>
      <div class="job-number">Job #${data.job.job_number}</div>
      <div class="report-date">Completed: ${completedDate}</div>
    </div>
  </div>

  <!-- Job Info -->
  <div class="info-grid">
    <div>
      <div class="info-block">
        <div class="info-label">Client</div>
        <div class="info-value">${clientName}</div>
      </div>
      ${
        data.client.phone
          ? `<div class="info-block">
        <div class="info-label">Phone</div>
        <div class="info-value">${data.client.phone}</div>
      </div>`
          : ''
      }
      ${
        data.client.email
          ? `<div class="info-block">
        <div class="info-label">Email</div>
        <div class="info-value">${data.client.email}</div>
      </div>`
          : ''
      }
    </div>
    <div>
      <div class="info-block">
        <div class="info-label">Job Title</div>
        <div class="info-value">${data.job.title}</div>
      </div>
      ${
        address
          ? `<div class="info-block">
        <div class="info-label">Site Address</div>
        <div class="info-value">${address}</div>
      </div>`
          : ''
      }
      <div class="info-block">
        <div class="info-label">Completed By</div>
        <div class="info-value">${data.completedBy.full_name}</div>
      </div>
    </div>
  </div>

  <!-- Form Sections -->
  ${data.groups
    .map(
      (group) => `
    <div class="section">
      <div class="section-header">${group.group_name}</div>
      ${group.description ? `<div class="section-description">${group.description}</div>` : ''}

      ${group.questions
        .map(
          (question) => `
        <div class="question">
          <div class="question-text">${question.question_text}</div>
          <div class="question-type">${question.field_type.replace('_', ' ')}</div>

          ${formatAnswer(question)}

          ${
            question.photos && question.photos.length > 0
              ? `
            <div class="photos-grid">
              ${question.photos
                .map(
                  (photo) => `
                <div class="photo-container">
                  <img src="${photo.photo_url}" alt="${photo.caption || ''}" class="photo">
                  ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
                </div>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        </div>
      `
        )
        .join('')}
    </div>
  `
    )
    .join('')}

  <!-- All Photos Section -->
  ${
    data.photos && data.photos.length > 0
      ? `
    <div class="section">
      <div class="section-header">Photos</div>
      <div class="photos-grid">
        ${data.photos
          .map(
            (photo) => `
          <div class="photo-container">
            <img src="${photo.photo_url}" alt="${photo.caption || ''}" class="photo">
            <div class="photo-caption">
              ${photo.photo_type ? `<strong>${photo.photo_type}:</strong> ` : ''}
              ${photo.caption || ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
      : ''
  }

  <!-- Signatures -->
  <div class="signatures">
    <div class="signature-box">
      <div class="signature-label">Technician Signature</div>
      ${
        data.form.technician_signature_url
          ? `<img src="${data.form.technician_signature_url}" alt="Technician Signature" class="signature-image">`
          : '<div class="signature-line"></div>'
      }
      <div class="signature-name">${data.completedBy.full_name}</div>
      <div class="signature-date">${completedDate}</div>
    </div>

    ${
      data.form.client_signature_url
        ? `
      <div class="signature-box">
        <div class="signature-label">Client Signature</div>
        <img src="${data.form.client_signature_url}" alt="Client Signature" class="signature-image">
        <div class="signature-name">${clientName}</div>
        <div class="signature-date">${completedDate}</div>
      </div>
    `
        : ''
    }
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>This report was generated automatically by ${data.organization.name}</p>
    <p>Report ID: ${data.form.id}</p>
  </div>
</body>
</html>
  `
}

function formatAnswer(question: any): string {
  if (!question.answer || question.answer === '') {
    return '<div class="answer no-answer">No response provided</div>'
  }

  switch (question.field_type) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'time':
      return `<div class="answer">${question.answer}</div>`

    case 'radio':
    case 'dropdown':
      return `<div class="answer">${question.answer}</div>`

    case 'checkbox':
      if (typeof question.answer === 'boolean') {
        return question.answer
          ? '<div class="answer-checkbox checked"><span class="checkbox-icon"></span> Yes</div>'
          : '<div class="answer">No</div>'
      }
      // Multiple checkboxes
      if (Array.isArray(question.answer)) {
        return `
          <div>
            ${question.answer.map((item: any) => `<div class="answer-checkbox checked"><span class="checkbox-icon"></span> ${item}</div>`).join('')}
          </div>
        `
      }
      return `<div class="answer">${question.answer}</div>`

    default:
      return `<div class="answer">${JSON.stringify(question.answer)}</div>`
  }
}
