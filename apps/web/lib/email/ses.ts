import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'

// Validate AWS credentials are configured
const validateAwsConfig = () => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      'AWS SES credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables in Vercel.'
    )
  }
}

// Initialize SES client
const getSESClient = () => {
  validateAwsConfig()
  return new SESClient({
    region: process.env.AWS_REGION || 'ap-southeast-2', // Sydney region (default for Australian businesses)
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

interface SendEmailParams {
  to: string
  from: string
  replyTo?: string
  subject: string
  htmlBody: string
  textBody?: string
  attachments?: EmailAttachment[]
}

/**
 * Send email via AWS SES with optional attachments
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, from, replyTo, subject, htmlBody, textBody, attachments = [] } = params

  // Build email in MIME format
  const boundary = `----=_Part_${Date.now()}`
  const altBoundary = `----=_Part_Alt_${Date.now()}`

  let rawMessage = `From: ${from}\n`
  rawMessage += `To: ${to}\n`
  if (replyTo) {
    rawMessage += `Reply-To: ${replyTo}\n`
  }
  rawMessage += `Subject: ${subject}\n`
  rawMessage += `MIME-Version: 1.0\n`
  rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`

  // Add message body
  rawMessage += `--${boundary}\n`
  rawMessage += `Content-Type: multipart/alternative; boundary="${altBoundary}"\n\n`

  // Plain text version
  if (textBody) {
    rawMessage += `--${altBoundary}\n`
    rawMessage += `Content-Type: text/plain; charset=UTF-8\n\n`
    rawMessage += `${textBody}\n\n`
  }

  // HTML version
  rawMessage += `--${altBoundary}\n`
  rawMessage += `Content-Type: text/html; charset=UTF-8\n\n`
  rawMessage += `${htmlBody}\n\n`
  rawMessage += `--${altBoundary}--\n\n`

  // Add attachments
  for (const attachment of attachments) {
    rawMessage += `--${boundary}\n`
    rawMessage += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\n`
    rawMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\n`
    rawMessage += `Content-Transfer-Encoding: base64\n\n`
    rawMessage += `${attachment.content.toString('base64')}\n\n`
  }

  rawMessage += `--${boundary}--`

  // Send email via SES
  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage),
    },
  })

  try {
    const ses = getSESClient()
    await ses.send(command)
  } catch (error) {
    console.error('SES Error:', error)

    // Provide more helpful error messages
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase()

      // Check for common AWS SES errors
      if (errorMsg.includes('not configured')) {
        throw error // Re-throw our validation error
      }
      if (errorMsg.includes('security token') && errorMsg.includes('invalid')) {
        throw new Error(
          'AWS credentials are invalid. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Vercel environment variables. Make sure they are from an IAM user with SES permissions.'
        )
      }
      if (errorMsg.includes('email address is not verified')) {
        throw new Error(
          `Email address "${from}" is not verified in AWS SES. Go to AWS Console → SES → Verified identities and verify this email or domain.`
        )
      }
      if (errorMsg.includes('not authorized') || errorMsg.includes('accessdenied')) {
        throw new Error(
          'AWS IAM user does not have SES permissions. Please attach the AmazonSESFullAccess policy to your IAM user.'
        )
      }
      if (errorMsg.includes('messagereject')) {
        throw new Error(
          `AWS SES is in sandbox mode and can only send to verified email addresses. Either verify "${to}" in SES or request production access.`
        )
      }
      throw new Error(`Failed to send email via AWS SES: ${error.message}`)
    }
    throw new Error('Failed to send email via AWS SES')
  }
}
