import { neon } from '@neondatabase/serverless'
import crypto from 'crypto'

/**
 * Webhook System for Tradie App
 *
 * Triggers webhooks to external systems when events occur.
 * Supports filtering, retry logic, and HMAC signature verification.
 */

// Event types supported by the webhook system
export type WebhookEventType =
  // Job events
  | 'job.created'
  | 'job.updated'
  | 'job.completed'
  | 'job.status_changed'
  | 'job.assigned'
  | 'job.deleted'
  // Client events
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  // Invoice events
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'invoice.partially_paid'
  | 'invoice.overdue'
  | 'invoice.deleted'
  // Quote events
  | 'quote.created'
  | 'quote.sent'
  | 'quote.accepted'
  | 'quote.rejected'
  | 'quote.expired'
  | 'quote.deleted'
  // Appointment events
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.cancelled'
  | 'appointment.reminder'
  // Expense events
  | 'expense.created'
  | 'expense.approved'
  | 'expense.rejected'
  // SMS events
  | 'sms.received'
  | 'sms.sent'
  // Time tracking events
  | 'time_log.created'
  | 'time_log.approved'
  // Completion form events
  | 'completion_form.submitted'
  | 'completion_form.updated'
  // Payment events
  | 'payment.received'
  | 'payment.refunded'

export interface WebhookPayload {
  event_type: WebhookEventType
  event_id: string
  organization_id: string
  timestamp: string
  data: Record<string, any>
}

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(params: {
  organizationId: string
  eventType: WebhookEventType
  data: Record<string, any>
}): Promise<void> {
  const { organizationId, eventType, data } = params

  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Find active subscriptions for this event
    const subscriptions = await sql`
      SELECT
        id,
        subscription_id,
        target_url,
        filters,
        secret_key,
        headers,
        max_retries,
        retry_delay_seconds
      FROM webhook_subscriptions
      WHERE organization_id = ${organizationId}
      AND event_type = ${eventType}
      AND is_active = true
    `

    if (subscriptions.length === 0) {
      return // No subscribers for this event
    }

    // Generate unique event ID
    const eventId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    // Build the payload
    const payload: WebhookPayload = {
      event_type: eventType,
      event_id: eventId,
      organization_id: organizationId,
      timestamp,
      data,
    }

    // Trigger webhooks in parallel (don't await all - fire and forget for better performance)
    const deliveryPromises = subscriptions.map(async (subscription: any) => {
      // Check if payload matches subscription filters
      if (subscription.filters && Object.keys(subscription.filters).length > 0) {
        if (!matchesFilters(data, subscription.filters)) {
          return // Skip - doesn't match filters
        }
      }

      // Deliver the webhook
      await deliverWebhook({
        subscriptionId: subscription.id,
        organizationId,
        eventType,
        eventId,
        targetUrl: subscription.target_url,
        payload,
        secretKey: subscription.secret_key,
        customHeaders: subscription.headers || {},
        maxRetries: subscription.max_retries || 3,
        retryDelaySeconds: subscription.retry_delay_seconds || 60,
      })
    })

    // Don't wait for all deliveries - let them happen in the background
    // This prevents webhook delivery from slowing down the main request
    Promise.allSettled(deliveryPromises).catch((error) => {
      console.error('Error triggering webhooks:', error)
    })
  } catch (error) {
    console.error('Error triggering webhooks:', error)
    // Don't throw - webhook failures shouldn't break the main operation
  }
}

/**
 * Check if data matches subscription filters
 */
function matchesFilters(data: Record<string, any>, filters: Record<string, any>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    // Support nested key lookup (e.g., "client.type" -> data.client.type)
    const dataValue = key.split('.').reduce((obj, k) => obj?.[k], data)

    // Support array filters (e.g., status: ['completed', 'invoiced'])
    if (Array.isArray(value)) {
      if (!value.includes(dataValue)) {
        return false
      }
    } else if (dataValue !== value) {
      return false
    }
  }
  return true
}

/**
 * Deliver a webhook with retry logic
 */
async function deliverWebhook(params: {
  subscriptionId: string
  organizationId: string
  eventType: string
  eventId: string
  targetUrl: string
  payload: WebhookPayload
  secretKey?: string
  customHeaders: Record<string, string>
  maxRetries: number
  retryDelaySeconds: number
}): Promise<void> {
  const {
    subscriptionId,
    organizationId,
    eventType,
    eventId,
    targetUrl,
    payload,
    secretKey,
    customHeaders,
    maxRetries,
    retryDelaySeconds,
  } = params

  const sql = neon(process.env.DATABASE_URL!)
  const payloadString = JSON.stringify(payload)

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'TradieApp-Webhooks/1.0',
    'X-Webhook-Event': eventType,
    'X-Webhook-Event-ID': eventId,
    'X-Webhook-Timestamp': payload.timestamp,
    ...customHeaders,
  }

  // Add signature if secret key is provided
  if (secretKey) {
    const signature = generateWebhookSignature(payloadString, secretKey)
    headers['X-Webhook-Signature'] = `sha256=${signature}`
  }

  // Create log entry
  const logResult = await sql`
    INSERT INTO webhook_logs (
      subscription_id,
      organization_id,
      event_type,
      event_id,
      target_url,
      request_payload,
      request_headers,
      status
    ) VALUES (
      ${subscriptionId},
      ${organizationId},
      ${eventType},
      ${eventId},
      ${targetUrl},
      ${JSON.stringify(payload)},
      ${JSON.stringify(headers)},
      'pending'
    )
    RETURNING id
  `

  const logId = logResult[0].id
  let retryCount = 0
  let lastError: Error | null = null

  while (retryCount <= maxRetries) {
    const startTime = Date.now()

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })

      const deliveryDurationMs = Date.now() - startTime
      const responseBody = await response.text().catch(() => '')

      // Update log with response
      await sql`
        UPDATE webhook_logs
        SET
          status_code = ${response.status},
          response_body = ${responseBody.substring(0, 10000)},
          delivery_duration_ms = ${deliveryDurationMs},
          retry_count = ${retryCount},
          status = ${response.ok ? 'success' : 'failed'},
          delivered_at = NOW()
        WHERE id = ${logId}
      `

      if (response.ok) {
        // Update subscription stats
        await sql`
          UPDATE webhook_subscriptions
          SET
            last_triggered_at = NOW(),
            trigger_count = trigger_count + 1,
            updated_at = NOW()
          WHERE id = ${subscriptionId}
        `
        return // Success!
      }

      // Non-2xx response - will retry
      lastError = new Error(`HTTP ${response.status}: ${responseBody.substring(0, 500)}`)
    } catch (error) {
      const deliveryDurationMs = Date.now() - startTime
      lastError = error instanceof Error ? error : new Error(String(error))

      // Update log with error
      await sql`
        UPDATE webhook_logs
        SET
          delivery_duration_ms = ${deliveryDurationMs},
          retry_count = ${retryCount},
          status = 'failed',
          response_body = ${lastError.message}
        WHERE id = ${logId}
      `
    }

    retryCount++

    if (retryCount <= maxRetries) {
      // Update log status to retrying
      const nextRetryAt = new Date(Date.now() + retryDelaySeconds * 1000 * retryCount)
      await sql`
        UPDATE webhook_logs
        SET
          status = 'retrying',
          next_retry_at = ${nextRetryAt.toISOString()},
          retry_count = ${retryCount}
        WHERE id = ${logId}
      `

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, retryDelaySeconds * 1000 * retryCount))
    }
  }

  // All retries failed
  await sql`
    UPDATE webhook_logs
    SET status = 'failed'
    WHERE id = ${logId}
  `

  // Update subscription failure stats
  await sql`
    UPDATE webhook_subscriptions
    SET
      failure_count = failure_count + 1,
      last_failure_at = NOW(),
      last_failure_reason = ${lastError?.message || 'Unknown error'},
      updated_at = NOW()
    WHERE id = ${subscriptionId}
  `

  console.error(`Webhook delivery failed after ${maxRetries} retries:`, lastError)
}

/**
 * Helper function to trigger job-related webhooks
 */
export async function triggerJobWebhook(
  organizationId: string,
  eventType: 'job.created' | 'job.updated' | 'job.completed' | 'job.status_changed' | 'job.assigned' | 'job.deleted',
  jobData: Record<string, any>
): Promise<void> {
  await triggerWebhooks({
    organizationId,
    eventType,
    data: jobData,
  })
}

/**
 * Helper function to trigger client-related webhooks
 */
export async function triggerClientWebhook(
  organizationId: string,
  eventType: 'client.created' | 'client.updated' | 'client.deleted',
  clientData: Record<string, any>
): Promise<void> {
  await triggerWebhooks({
    organizationId,
    eventType,
    data: clientData,
  })
}

/**
 * Helper function to trigger invoice-related webhooks
 */
export async function triggerInvoiceWebhook(
  organizationId: string,
  eventType: 'invoice.created' | 'invoice.sent' | 'invoice.paid' | 'invoice.partially_paid' | 'invoice.overdue' | 'invoice.deleted',
  invoiceData: Record<string, any>
): Promise<void> {
  await triggerWebhooks({
    organizationId,
    eventType,
    data: invoiceData,
  })
}

/**
 * Helper function to trigger quote-related webhooks
 */
export async function triggerQuoteWebhook(
  organizationId: string,
  eventType: 'quote.created' | 'quote.sent' | 'quote.accepted' | 'quote.rejected' | 'quote.expired' | 'quote.deleted',
  quoteData: Record<string, any>
): Promise<void> {
  await triggerWebhooks({
    organizationId,
    eventType,
    data: quoteData,
  })
}

/**
 * Helper function to trigger completion form webhooks
 */
export async function triggerCompletionFormWebhook(
  organizationId: string,
  eventType: 'completion_form.submitted' | 'completion_form.updated',
  formData: Record<string, any>
): Promise<void> {
  await triggerWebhooks({
    organizationId,
    eventType,
    data: formData,
  })
}
