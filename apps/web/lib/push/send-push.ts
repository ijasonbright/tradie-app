import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk'

// Create a new Expo SDK client
const expo = new Expo()

interface PushNotificationData {
  userId?: string
  userIds?: string[]
  title: string
  body: string
  data?: Record<string, any>
  badge?: number
  sound?: 'default' | null
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
}

/**
 * Send push notification to one or more users
 */
export async function sendPushNotification({
  userId,
  userIds,
  title,
  body,
  data = {},
  badge,
  sound = 'default',
  priority = 'high',
  channelId = 'default',
}: PushNotificationData): Promise<{
  success: boolean
  tickets?: ExpoPushTicket[]
  error?: string
}> {
  try {
    // Get push tokens for the user(s)
    const tokens = await getUserPushTokens(userId ? [userId] : userIds || [])

    if (tokens.length === 0) {
      return {
        success: false,
        error: 'No push tokens found for specified user(s)',
      }
    }

    // Create the messages
    const messages: ExpoPushMessage[] = tokens.map(token => ({
      to: token,
      sound,
      title,
      body,
      data,
      badge,
      priority,
      channelId,
    }))

    // Send the messages in chunks
    const chunks = expo.chunkPushNotifications(messages)
    const tickets: ExpoPushTicket[] = []

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
        tickets.push(...ticketChunk)
      } catch (error) {
        console.error('Error sending push notification chunk:', error)
      }
    }

    // Check for errors in tickets
    const errors = tickets.filter(
      ticket => ticket.status === 'error'
    )

    if (errors.length > 0) {
      console.error('Push notification errors:', errors)
    }

    return {
      success: true,
      tickets,
    }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get push tokens for specified user IDs
 */
async function getUserPushTokens(userIds: string[]): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not configured')
    return []
  }

  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(process.env.DATABASE_URL)

  try {
    const result = await sql`
      SELECT expo_push_token
      FROM users
      WHERE clerk_user_id = ANY(${userIds})
      AND expo_push_token IS NOT NULL
    `

    // Validate tokens
    const tokens = result
      .map(row => row.expo_push_token)
      .filter(token => Expo.isExpoPushToken(token))

    return tokens
  } catch (error) {
    console.error('Error fetching push tokens:', error)
    return []
  }
}

/**
 * Send notification when job is assigned
 */
export async function sendJobAssignedNotification(
  userId: string,
  jobData: { id: string; title: string; clientName: string }
) {
  return sendPushNotification({
    userId,
    title: 'New Job Assigned',
    body: `You have been assigned to: ${jobData.title} - ${jobData.clientName}`,
    data: {
      type: 'job_assigned',
      job_id: jobData.id,
    },
  })
}

/**
 * Send notification when invoice is paid
 */
export async function sendInvoicePaidNotification(
  userId: string,
  invoiceData: { id: string; invoiceNumber: string; amount: number }
) {
  return sendPushNotification({
    userId,
    title: 'Invoice Paid',
    body: `Invoice ${invoiceData.invoiceNumber} has been paid ($${invoiceData.amount.toFixed(2)})`,
    data: {
      type: 'invoice_paid',
      invoice_id: invoiceData.id,
    },
  })
}

/**
 * Send notification for document expiring soon
 */
export async function sendDocumentExpiringNotification(
  userId: string,
  documentData: { title: string; expiryDate: string; daysUntilExpiry: number }
) {
  return sendPushNotification({
    userId,
    title: 'Document Expiring Soon',
    body: `${documentData.title} expires in ${documentData.daysUntilExpiry} days (${documentData.expiryDate})`,
    data: {
      type: 'document_expiring',
    },
    priority: 'high',
  })
}

/**
 * Send appointment reminder
 */
export async function sendAppointmentReminderNotification(
  userId: string,
  appointmentData: { id: string; title: string; startTime: string }
) {
  return sendPushNotification({
    userId,
    title: 'Appointment Reminder',
    body: `${appointmentData.title} starts at ${appointmentData.startTime}`,
    data: {
      type: 'appointment_reminder',
      appointment_id: appointmentData.id,
    },
    priority: 'high',
  })
}

/**
 * Send notification when job is completed and needs invoicing
 */
export async function sendJobCompletionPendingInvoiceNotification(
  userId: string,
  jobData: { id: string; jobNumber: string; clientName: string }
) {
  return sendPushNotification({
    userId,
    title: 'Job Ready to Invoice',
    body: `Job ${jobData.jobNumber} for ${jobData.clientName} is completed and ready for invoicing`,
    data: {
      type: 'job_completion_pending_invoice',
      job_id: jobData.id,
    },
  })
}
