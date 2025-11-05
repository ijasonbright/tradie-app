import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

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
  try {
    console.log('[PDF Generator] Starting PDF generation')
    const { form, job, client, organization, template, groups, completedBy, photos } = data

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595, 842]) // A4 size in points

    // Load fonts
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    console.log('[PDF Generator] Fonts loaded')

  // Colors
  const primaryColor = rgb(0.15, 0.39, 0.92) // Blue #2563eb
  const textColor = rgb(0.12, 0.16, 0.22) // Dark gray
  const lightGray = rgb(0.42, 0.45, 0.50)
  const veryLightGray = rgb(0.98, 0.98, 0.99)

  // Load logo if available
  let logoImage = null
  let logoWidth = 0
  let logoHeight = 0
  if (organization.logo_url) {
    try {
      console.log('[PDF Generator] Loading logo from:', organization.logo_url)
      const logoResponse = await fetch(organization.logo_url)
      if (!logoResponse.ok) {
        throw new Error(`Failed to fetch logo: ${logoResponse.status}`)
      }
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
        console.log('[PDF Generator] Logo loaded successfully')
      }
    } catch (error) {
      console.error('[PDF Generator] Failed to load logo:', error)
    }
  }

  // Helper to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Helper to wrap text
  const wrapText = (text: string, maxWidth: number, fontSize: number, font: any): string[] => {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
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
    size: logoImage ? 18 : 24,
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

  // Report Title
  yPosition -= 20
  page.drawText('JOB COMPLETION REPORT', {
    x: 50,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: textColor,
  })

  // Job details (right side)
  const rightX = 380
  let rightY = height - 120

  page.drawText('Job Number:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  page.drawText(job.job_number, {
    x: rightX,
    y: rightY - 15,
    size: 10,
    font: boldFont,
    color: textColor,
  })

  rightY -= 45
  page.drawText('Completed:', {
    x: rightX,
    y: rightY,
    size: 10,
    font: regularFont,
    color: lightGray,
  })
  page.drawText(formatDate(form.completed_date), {
    x: rightX,
    y: rightY - 15,
    size: 10,
    font: regularFont,
    color: textColor,
  })

  // Job title
  yPosition -= 60
  page.drawText(job.title, {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: textColor,
  })
  yPosition -= 25

  // Client section
  page.drawText('CLIENT', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: primaryColor,
  })
  yPosition -= 18

  const clientName = client.company_name || `${client.first_name} ${client.last_name}`
  page.drawText(clientName, {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont,
    color: textColor,
  })
  yPosition -= 15

  const clientDetails = []
  const siteAddress = [job.site_address_line1, job.site_address_line2].filter(Boolean).join(', ')
  if (siteAddress) clientDetails.push(siteAddress)
  if (job.site_city || job.site_state || job.site_postcode) {
    clientDetails.push([job.site_city, job.site_state, job.site_postcode].filter(Boolean).join(', '))
  }
  if (client.email) clientDetails.push(`Email: ${client.email}`)
  if (client.phone) clientDetails.push(`Phone: ${client.phone}`)

  clientDetails.forEach((detail) => {
    page.drawText(detail, {
      x: 50,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
    yPosition -= 15
  })

  yPosition -= 20

  // Template name and description
  page.drawText(template.name, {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: primaryColor,
  })
  yPosition -= 15

  if (template.description) {
    const descLines = wrapText(template.description, 495, 10, regularFont)
    descLines.forEach((line) => {
      page.drawText(line, {
        x: 50,
        y: yPosition,
        size: 10,
        font: regularFont,
        color: lightGray,
      })
      yPosition -= 13
    })
  }

  yPosition -= 20

  // Groups and Questions
  for (const group of groups) {
    // Check if we need a new page
    if (yPosition < 150) {
      page = pdfDoc.addPage([595, 842])
      yPosition = height - 50
    }

    // Group header
    page.drawRectangle({
      x: 50,
      y: yPosition - 5,
      width: 495,
      height: 25,
      color: veryLightGray,
    })

    page.drawText(group.group_name, {
      x: 55,
      y: yPosition + 3,
      size: 11,
      font: boldFont,
      color: primaryColor,
    })
    yPosition -= 30

    // Questions and answers (no photos inline)
    for (const question of group.questions) {
      // Check if we need a new page
      if (yPosition < 100) {
        page = pdfDoc.addPage([595, 842])
        yPosition = height - 50
      }

      // Question text
      const questionLines = wrapText(question.question_text, 490, 10, boldFont)
      questionLines.forEach((line) => {
        page.drawText(line, {
          x: 55,
          y: yPosition,
          size: 10,
          font: boldFont,
          color: textColor,
        })
        yPosition -= 15
      })

      // Answer
      const answerText = question.answer ? String(question.answer) : 'N/A'
      const answerLines = wrapText(answerText, 490, 9, regularFont)
      answerLines.forEach((line) => {
        page.drawText(line, {
          x: 65,
          y: yPosition,
          size: 9,
          font: regularFont,
          color: lightGray,
        })
        yPosition -= 14
      })

      yPosition -= 10
    }

    // Add group photos section if there are any photos in this group
    const groupPhotos = group.questions
      .flatMap(q => q.photos || [])

    console.log(`[PDF Generator] Group "${group.group_name}" processing ${groupPhotos.length} photos`)

    if (groupPhotos.length > 0) {
      // Check if we need a new page
      if (yPosition < 150) {
        page = pdfDoc.addPage([595, 842])
        yPosition = height - 50
      }

      yPosition -= 20

      // Photos section header with orange background (like your example)
      const orangeColor = rgb(0.95, 0.55, 0.2) // Orange #F28C33
      page.drawRectangle({
        x: 50,
        y: yPosition - 5,
        width: 495,
        height: 25,
        color: orangeColor,
      })

      page.drawText(`${group.group_name} - Photos`, {
        x: 55,
        y: yPosition + 3,
        size: 11,
        font: boldFont,
        color: rgb(1, 1, 1), // White text
      })
      yPosition -= 35

      // Draw photos in a grid (2 per row)
      let photosInRow = 0
      let currentRowY = yPosition
      const photoSpacing = 250 // Space between photos horizontally
      const photoMaxWidth = 230
      const photoMaxHeight = 150

      for (const photo of groupPhotos) {
        try {
          // Check if we need a new page
          if (currentRowY < 200) {
            page = pdfDoc.addPage([595, 842])
            yPosition = height - 50
            currentRowY = yPosition
            photosInRow = 0
          }

          console.log('[PDF Generator] Loading group photo from:', photo.photo_url)
          const photoResponse = await fetch(photo.photo_url)
          if (!photoResponse.ok) {
            console.error('[PDF Generator] Failed to fetch photo:', photoResponse.status)
            continue
          }

          const photoBytes = await photoResponse.arrayBuffer()
          const photoExt = photo.photo_url.toLowerCase()

          let photoImage
          if (photoExt.includes('.png')) {
            photoImage = await pdfDoc.embedPng(photoBytes)
          } else if (photoExt.includes('.jpg') || photoExt.includes('.jpeg')) {
            photoImage = await pdfDoc.embedJpg(photoBytes)
          } else {
            try {
              photoImage = await pdfDoc.embedJpg(photoBytes)
            } catch {
              photoImage = await pdfDoc.embedPng(photoBytes)
            }
          }

          // Scale photo to fit
          const photoDims = photoImage.scale(1)
          let photoWidth = photoDims.width
          let photoHeight = photoDims.height

          if (photoWidth > photoMaxWidth) {
            const scale = photoMaxWidth / photoWidth
            photoWidth = photoMaxWidth
            photoHeight = photoHeight * scale
          }
          if (photoHeight > photoMaxHeight) {
            const scale = photoMaxHeight / photoHeight
            photoHeight = photoMaxHeight
            photoWidth = photoWidth * scale
          }

          // Calculate X position based on which photo in the row
          const xPosition = 55 + (photosInRow * photoSpacing)

          // Draw photo
          page.drawImage(photoImage, {
            x: xPosition,
            y: currentRowY - photoHeight,
            width: photoWidth,
            height: photoHeight,
          })

          // Draw caption if exists
          if (photo.caption) {
            const captionLines = wrapText(photo.caption, photoMaxWidth - 10, 8, regularFont)
            let captionY = currentRowY - photoHeight - 15
            captionLines.forEach(line => {
              page.drawText(line, {
                x: xPosition,
                y: captionY,
                size: 8,
                font: regularFont,
                color: lightGray,
              })
              captionY -= 12
            })
          }

          photosInRow++

          // Move to next row after 2 photos
          if (photosInRow >= 2) {
            const maxPhotoHeightInRow = photoMaxHeight // Simplified for now
            currentRowY -= maxPhotoHeightInRow + (photo.caption ? 35 : 20)
            photosInRow = 0
          }

          console.log('[PDF Generator] Group photo added successfully')
        } catch (error) {
          console.error('[PDF Generator] Failed to load group photo:', error)
        }
      }

      // Adjust yPosition after all photos
      if (photosInRow > 0) {
        currentRowY -= photoMaxHeight + 20
      }
      yPosition = currentRowY - 20
    }

    yPosition -= 10
  }

  // Add all job photos at the end if we have any
  if (photos && photos.length > 0) {
    console.log(`[PDF Generator] Adding ${photos.length} job photos in dedicated section`)

    // Check if we need a new page
    if (yPosition < 150) {
      page = pdfDoc.addPage([595, 842])
      yPosition = height - 50
    }

    yPosition -= 20

    // Photos section header with orange background
    const orangeColor = rgb(0.95, 0.55, 0.2)
    page.drawRectangle({
      x: 50,
      y: yPosition - 5,
      width: 495,
      height: 25,
      color: orangeColor,
    })

    page.drawText('Job Photos', {
      x: 55,
      y: yPosition + 3,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    })
    yPosition -= 35

    // Draw photos in a grid (2 per row)
    let photosInRow = 0
    let currentRowY = yPosition
    const photoSpacing = 250
    const photoMaxWidth = 230
    const photoMaxHeight = 150

    for (const photo of photos) {
      try {
        // Check if we need a new page
        if (currentRowY < 200) {
          page = pdfDoc.addPage([595, 842])
          yPosition = height - 50
          currentRowY = yPosition
          photosInRow = 0
        }

        console.log('[PDF Generator] Loading job photo from:', photo.photo_url)
        const photoResponse = await fetch(photo.photo_url)
        if (!photoResponse.ok) {
          console.error('[PDF Generator] Failed to fetch photo:', photoResponse.status)
          continue
        }

        const photoBytes = await photoResponse.arrayBuffer()
        const photoExt = photo.photo_url.toLowerCase()

        let photoImage
        if (photoExt.includes('.png')) {
          photoImage = await pdfDoc.embedPng(photoBytes)
        } else if (photoExt.includes('.jpg') || photoExt.includes('.jpeg')) {
          photoImage = await pdfDoc.embedJpg(photoBytes)
        } else {
          try {
            photoImage = await pdfDoc.embedJpg(photoBytes)
          } catch {
            photoImage = await pdfDoc.embedPng(photoBytes)
          }
        }

        // Scale photo to fit
        const photoDims = photoImage.scale(1)
        let photoWidth = photoDims.width
        let photoHeight = photoDims.height

        if (photoWidth > photoMaxWidth) {
          const scale = photoMaxWidth / photoWidth
          photoWidth = photoMaxWidth
          photoHeight = photoHeight * scale
        }
        if (photoHeight > photoMaxHeight) {
          const scale = photoMaxHeight / photoHeight
          photoHeight = photoMaxHeight
          photoWidth = photoWidth * scale
        }

        // Calculate X position based on which photo in the row
        const xPosition = 55 + (photosInRow * photoSpacing)

        // Draw photo
        page.drawImage(photoImage, {
          x: xPosition,
          y: currentRowY - photoHeight,
          width: photoWidth,
          height: photoHeight,
        })

        // Draw caption if exists
        if (photo.caption) {
          const captionLines = wrapText(photo.caption, photoMaxWidth - 10, 8, regularFont)
          let captionY = currentRowY - photoHeight - 15
          captionLines.forEach(line => {
            page.drawText(line, {
              x: xPosition,
              y: captionY,
              size: 8,
              font: regularFont,
              color: lightGray,
            })
            captionY -= 12
          })
        }

        photosInRow++

        // Move to next row after 2 photos
        if (photosInRow >= 2) {
          const maxPhotoHeightInRow = photoMaxHeight
          currentRowY -= maxPhotoHeightInRow + (photo.caption ? 35 : 20)
          photosInRow = 0
        }

        console.log('[PDF Generator] Job photo added successfully')
      } catch (error) {
        console.error('[PDF Generator] Failed to load job photo:', error)
      }
    }

    // Adjust yPosition after all photos
    if (photosInRow > 0) {
      currentRowY -= photoMaxHeight + 20
    }
    yPosition = currentRowY - 20
  }

  // Technician signature section
  if (yPosition < 100) {
    page = pdfDoc.addPage([595, 842])
    yPosition = height - 50
  }

  yPosition -= 20
  page.drawText('COMPLETED BY', {
    x: 50,
    y: yPosition,
    size: 12,
    font: boldFont,
    color: primaryColor,
  })
  yPosition -= 20

  page.drawText(completedBy.full_name, {
    x: 50,
    y: yPosition,
    size: 10,
    font: boldFont,
    color: textColor,
  })
  yPosition -= 15

  if (completedBy.email) {
    page.drawText(completedBy.email, {
      x: 50,
      y: yPosition,
      size: 10,
      font: regularFont,
      color: lightGray,
    })
    yPosition -= 20
  }

  // Technician signature
  if (form.technician_signature_url) {
    try {
      const sigResponse = await fetch(form.technician_signature_url)
      const sigBytes = await sigResponse.arrayBuffer()
      const sigExt = form.technician_signature_url.toLowerCase()

      let sigImage
      if (sigExt.includes('.png')) {
        sigImage = await pdfDoc.embedPng(sigBytes)
      } else if (sigExt.includes('.jpg') || sigExt.includes('.jpeg')) {
        sigImage = await pdfDoc.embedJpg(sigBytes)
      } else {
        // Try PNG first, fallback to JPG
        try {
          sigImage = await pdfDoc.embedPng(sigBytes)
        } catch {
          sigImage = await pdfDoc.embedJpg(sigBytes)
        }
      }

      const sigDims = sigImage.scale(0.2)

      page.drawImage(sigImage, {
        x: 50,
        y: yPosition - sigDims.height,
        width: Math.min(sigDims.width, 150),
        height: Math.min(sigDims.height, 50),
      })
      yPosition -= 60
    } catch (error) {
      console.error('Failed to load technician signature:', error)
      page.drawText('Signature on file', {
        x: 50,
        y: yPosition,
        size: 9,
        font: regularFont,
        color: lightGray,
      })
      yPosition -= 20
    }
  }

  page.drawText(formatDate(form.completed_date), {
    x: 50,
    y: yPosition,
    size: 9,
    font: regularFont,
    color: lightGray,
  })

  // Footer
  const footerText = `Generated on ${formatDate(new Date().toISOString())}`
  const footerWidth = regularFont.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: 30,
    size: 8,
    font: regularFont,
    color: lightGray,
  })

    // Serialize the PDF to bytes
    console.log('[PDF Generator] Saving PDF')
    const pdfBytes = await pdfDoc.save()
    console.log('[PDF Generator] PDF saved, size:', pdfBytes.length, 'bytes')
    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('[PDF Generator] Error generating PDF:', error)
    throw error
  }
}
