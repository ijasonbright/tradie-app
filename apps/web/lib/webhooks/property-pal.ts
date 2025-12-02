/**
 * Property Pal Webhook Sender
 *
 * Sends webhook notifications to Property Pal when job status changes
 * for jobs that originated from Property Pal work orders.
 */

const PROPERTY_PAL_WEBHOOK_URL = process.env.PROPERTY_PAL_WEBHOOK_URL || 'https://propertypal.vercel.app'
const PROPERTY_PAL_API_KEY = process.env.PROPERTY_PAL_API_KEY || ''

type WebhookEvent =
  | 'job.scheduled'
  | 'job.started'
  | 'job.completed'
  | 'job.cancelled'
  | 'job.photos_added'
  | 'job.notes_updated'
  | 'invoice.created'
  | 'quote.submitted'

interface JobPhoto {
  url: string
  caption?: string
  photo_type: string
  uploaded_at: string
}

interface JobWebhookPayload {
  event: WebhookEvent
  job_id: string
  job_number: string
  external_work_order_id: string
  status: string
  scheduled_date?: string
  completed_at?: string
  notes?: string
  actual_amount?: number
  photos?: JobPhoto[]
}

interface QuoteWebhookPayload {
  event: 'quote.submitted'
  external_work_order_id: string
  quote_id: string
  quote_number: string
  total_amount: number
  gst_amount?: number
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  valid_until?: string
  notes?: string
}

interface InvoiceWebhookPayload {
  event: 'invoice.created'
  external_work_order_id: string
  invoice_id: string
  invoice_number: string
  job_id: string
  total_amount: number
  gst_amount?: number
  due_date?: string
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
}

async function sendWebhook(
  endpoint: string,
  payload: JobWebhookPayload | QuoteWebhookPayload | InvoiceWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${PROPERTY_PAL_WEBHOOK_URL}${endpoint}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PROPERTY_PAL_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`Webhook to Property Pal failed: ${response.status}`, error)
      return { success: false, error: error.error || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending webhook to Property Pal:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send job status update webhook to Property Pal
 */
export async function sendJobWebhook(
  event: WebhookEvent,
  job: {
    id: string
    job_number: string
    external_work_order_id: string | null
    external_source: string | null
    status: string
    scheduled_date?: Date | null
    completed_at?: Date | null
    actual_amount?: number | string | null
  },
  options?: {
    notes?: string
    photos?: JobPhoto[]
  }
): Promise<{ success: boolean; error?: string }> {
  // Only send webhook if job originated from Property Pal
  if (!job.external_work_order_id || job.external_source !== 'property_pal') {
    return { success: true } // Not a Property Pal job, skip
  }

  const payload: JobWebhookPayload = {
    event,
    job_id: job.id,
    job_number: job.job_number,
    external_work_order_id: job.external_work_order_id,
    status: job.status,
    scheduled_date: job.scheduled_date?.toISOString(),
    completed_at: job.completed_at?.toISOString(),
    actual_amount: job.actual_amount ? Number(job.actual_amount) : undefined,
    notes: options?.notes,
    photos: options?.photos,
  }

  return sendWebhook('/api/webhooks/tradieapp/jobs', payload)
}

/**
 * Send quote submitted webhook to Property Pal
 */
export async function sendQuoteWebhook(
  externalWorkOrderId: string,
  quote: {
    id: string
    quote_number: string
    total_amount: number
    gst_amount?: number
    valid_until?: Date
    notes?: string
    line_items: Array<{
      description: string
      quantity: number
      unit_price: number
      total: number
    }>
  }
): Promise<{ success: boolean; error?: string }> {
  const payload: QuoteWebhookPayload = {
    event: 'quote.submitted',
    external_work_order_id: externalWorkOrderId,
    quote_id: quote.id,
    quote_number: quote.quote_number,
    total_amount: quote.total_amount,
    gst_amount: quote.gst_amount,
    line_items: quote.line_items,
    valid_until: quote.valid_until?.toISOString(),
    notes: quote.notes,
  }

  return sendWebhook('/api/webhooks/tradieapp/quotes', payload)
}

/**
 * Send invoice created webhook to Property Pal
 */
export async function sendInvoiceWebhook(
  externalWorkOrderId: string,
  invoice: {
    id: string
    invoice_number: string
    job_id: string
    total_amount: number
    gst_amount?: number
    due_date?: Date
    line_items: Array<{
      description: string
      quantity: number
      unit_price: number
      total: number
    }>
  }
): Promise<{ success: boolean; error?: string }> {
  const payload: InvoiceWebhookPayload = {
    event: 'invoice.created',
    external_work_order_id: externalWorkOrderId,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    job_id: invoice.job_id,
    total_amount: invoice.total_amount,
    gst_amount: invoice.gst_amount,
    due_date: invoice.due_date?.toISOString(),
    line_items: invoice.line_items,
  }

  return sendWebhook('/api/webhooks/tradieapp/invoices', payload)
}

export const propertyPalWebhooks = {
  sendJobWebhook,
  sendQuoteWebhook,
  sendInvoiceWebhook,
}
