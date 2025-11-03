import Stripe from 'stripe'
import { randomBytes } from 'crypto'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-10-29.clover' })
  : null

if (!stripe) {
  console.warn('Stripe not configured - STRIPE_SECRET_KEY missing')
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Generate a secure random token for public URLs
 * Using base64url encoding for shorter URLs (16 bytes = 22 chars vs 64 chars with hex)
 */
export function generatePublicToken(): string {
  return randomBytes(16)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

interface CreateQuoteDepositPaymentLinkParams {
  quoteId: string
  quoteNumber: string
  organizationId: string
  depositAmount: number
  publicToken: string
  clientName: string
}

/**
 * Create a Stripe Payment Link for a quote deposit
 */
export async function createQuoteDepositPaymentLink(
  params: CreateQuoteDepositPaymentLinkParams
): Promise<{ paymentLink: Stripe.PaymentLink; error?: string }> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  const { quoteId, quoteNumber, organizationId, depositAmount, publicToken, clientName } = params

  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `Deposit for Quote #${quoteNumber}`,
              description: `Quote deposit payment for ${clientName}`,
            },
            unit_amount: Math.round(depositAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'quote_deposit',
        organization_id: organizationId,
        quote_id: quoteId,
        quote_number: quoteNumber,
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${APP_URL}/public/quotes/${publicToken}/payment-success`,
        },
      },
    })

    return { paymentLink }
  } catch (error) {
    console.error('Error creating quote deposit payment link:', error)
    throw error
  }
}

interface CreateInvoicePaymentLinkParams {
  invoiceId: string
  invoiceNumber: string
  organizationId: string
  amount: number
  publicToken: string
  clientName: string
  description?: string
}

/**
 * Create a Stripe Payment Link for an invoice
 */
export async function createInvoicePaymentLink(
  params: CreateInvoicePaymentLinkParams
): Promise<{ paymentLink: Stripe.PaymentLink; error?: string }> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  const { invoiceId, invoiceNumber, organizationId, amount, publicToken, clientName, description } = params

  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `Invoice #${invoiceNumber}`,
              description: description || `Payment for ${clientName}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'invoice_payment',
        organization_id: organizationId,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${APP_URL}/public/invoices/${publicToken}/payment-success`,
        },
      },
    })

    return { paymentLink }
  } catch (error) {
    console.error('Error creating invoice payment link:', error)
    throw error
  }
}

interface CreatePaymentRequestLinkParams {
  paymentRequestId: string
  requestType: string
  organizationId: string
  amount: number
  publicToken: string
  description: string
}

/**
 * Create a Stripe Payment Link for a generic payment request
 */
export async function createPaymentRequestLink(
  params: CreatePaymentRequestLinkParams
): Promise<{ paymentLink: Stripe.PaymentLink; error?: string }> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  const { paymentRequestId, requestType, organizationId, amount, publicToken, description } = params

  try {
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: description,
              description: `Payment request`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'payment_request',
        organization_id: organizationId,
        payment_request_id: paymentRequestId,
        request_type: requestType,
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${APP_URL}/public/payment/${publicToken}/success`,
        },
      },
    })

    return { paymentLink }
  } catch (error) {
    console.error('Error creating payment request link:', error)
    throw error
  }
}

/**
 * Retrieve a Payment Link by ID
 */
export async function getPaymentLink(paymentLinkId: string): Promise<Stripe.PaymentLink | null> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  try {
    const paymentLink = await stripe.paymentLinks.retrieve(paymentLinkId)
    return paymentLink
  } catch (error) {
    console.error('Error retrieving payment link:', error)
    return null
  }
}

/**
 * Deactivate a Payment Link
 */
export async function deactivatePaymentLink(paymentLinkId: string): Promise<boolean> {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  try {
    await stripe.paymentLinks.update(paymentLinkId, { active: false })
    return true
  } catch (error) {
    console.error('Error deactivating payment link:', error)
    return false
  }
}
