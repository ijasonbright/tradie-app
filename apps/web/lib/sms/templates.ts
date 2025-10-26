/**
 * Default SMS templates with variable substitution
 */

export interface SMSTemplateVariables {
  clientName?: string
  businessName?: string
  invoiceNumber?: string
  quoteNumber?: string
  jobTitle?: string
  totalAmount?: string
  dueDate?: string
  validUntil?: string
  appointmentDate?: string
  appointmentTime?: string
  link?: string
}

export const DEFAULT_TEMPLATES = {
  invoice_sent: {
    name: 'Invoice Sent',
    template: 'Hi {{clientName}}, your invoice #{{invoiceNumber}} for ${{totalAmount}} is ready. View and pay here: {{link}} - {{businessName}}',
    variables: ['clientName', 'invoiceNumber', 'totalAmount', 'link', 'businessName'],
  },
  invoice_reminder: {
    name: 'Invoice Reminder',
    template: 'Hi {{clientName}}, friendly reminder that invoice #{{invoiceNumber}} for ${{totalAmount}} is due on {{dueDate}}. Pay here: {{link}} - {{businessName}}',
    variables: ['clientName', 'invoiceNumber', 'totalAmount', 'dueDate', 'link', 'businessName'],
  },
  invoice_overdue: {
    name: 'Invoice Overdue',
    template: 'Hi {{clientName}}, invoice #{{invoiceNumber}} for ${{totalAmount}} is now overdue. Please pay at your earliest convenience: {{link}} - {{businessName}}',
    variables: ['clientName', 'invoiceNumber', 'totalAmount', 'link', 'businessName'],
  },
  quote_sent: {
    name: 'Quote Sent',
    template: 'Hi {{clientName}}, your quote #{{quoteNumber}} for {{jobTitle}} is ready to view: {{link}}. Valid until {{validUntil}}. - {{businessName}}',
    variables: ['clientName', 'quoteNumber', 'jobTitle', 'link', 'validUntil', 'businessName'],
  },
  job_scheduled: {
    name: 'Job Scheduled',
    template: 'Hi {{clientName}}, your job is scheduled for {{appointmentDate}} at {{appointmentTime}}. We will see you then! - {{businessName}}',
    variables: ['clientName', 'appointmentDate', 'appointmentTime', 'businessName'],
  },
  job_on_way: {
    name: 'On Our Way',
    template: 'Hi {{clientName}}, we are on our way to your property. ETA: {{appointmentTime}}. - {{businessName}}',
    variables: ['clientName', 'appointmentTime', 'businessName'],
  },
  job_completed: {
    name: 'Job Completed',
    template: 'Hi {{clientName}}, we have completed work on {{jobTitle}}. Thank you for choosing {{businessName}}!',
    variables: ['clientName', 'jobTitle', 'businessName'],
  },
  payment_received: {
    name: 'Payment Received',
    template: 'Hi {{clientName}}, thank you! We have received your payment of ${{totalAmount}} for invoice #{{invoiceNumber}}. - {{businessName}}',
    variables: ['clientName', 'totalAmount', 'invoiceNumber', 'businessName'],
  },
}

/**
 * Replace template variables with actual values
 */
export function renderTemplate(template: string, variables: SMSTemplateVariables): string {
  let rendered = template

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      rendered = rendered.replace(regex, String(value))
    }
  }

  // Remove any remaining unreplaced variables
  rendered = rendered.replace(/{{[^}]+}}/g, '')

  return rendered.trim()
}

/**
 * Get template by type
 */
export function getTemplate(type: keyof typeof DEFAULT_TEMPLATES): string {
  return DEFAULT_TEMPLATES[type].template
}

/**
 * Validate template has all required variables
 */
export function validateTemplate(template: string, variables: SMSTemplateVariables): {
  valid: boolean
  missingVariables: string[]
} {
  const variablePattern = /{{([^}]+)}}/g
  const requiredVars = new Set<string>()
  let match

  while ((match = variablePattern.exec(template)) !== null) {
    requiredVars.add(match[1])
  }

  const missingVariables = Array.from(requiredVars).filter(
    (varName) => !(varName in variables) || variables[varName as keyof SMSTemplateVariables] === undefined
  )

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  }
}

/**
 * Create SMS message for invoice
 */
export function createInvoiceSMS(params: {
  clientName: string
  businessName: string
  invoiceNumber: string
  totalAmount: string
  dueDate?: string
  link: string
  type?: 'sent' | 'reminder' | 'overdue'
}): string {
  const templateType = params.type === 'reminder' ? 'invoice_reminder' :
                        params.type === 'overdue' ? 'invoice_overdue' :
                        'invoice_sent'

  return renderTemplate(getTemplate(templateType), params)
}

/**
 * Create SMS message for quote
 */
export function createQuoteSMS(params: {
  clientName: string
  businessName: string
  quoteNumber: string
  jobTitle: string
  validUntil: string
  link: string
}): string {
  return renderTemplate(getTemplate('quote_sent'), params)
}

/**
 * Create SMS message for job update
 */
export function createJobSMS(params: {
  clientName: string
  businessName: string
  jobTitle?: string
  appointmentDate?: string
  appointmentTime?: string
  type: 'scheduled' | 'on_way' | 'completed'
}): string {
  const templateType = params.type === 'scheduled' ? 'job_scheduled' :
                        params.type === 'on_way' ? 'job_on_way' :
                        'job_completed'

  return renderTemplate(getTemplate(templateType), params)
}
