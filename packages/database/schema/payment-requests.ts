import { pgTable, uuid, varchar, text, timestamp, decimal, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { clients } from './clients'
import { users } from './users'
import { quotes } from './quotes'
import { invoices } from './invoices'
import { jobs } from './jobs'

export const paymentRequests = pgTable('payment_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  requestType: varchar('request_type', { length: 50 }).notNull(), // 'quote_deposit' | 'invoice_full' | 'invoice_partial'
  // Related entities
  relatedQuoteId: uuid('related_quote_id').references(() => quotes.id),
  relatedInvoiceId: uuid('related_invoice_id').references(() => invoices.id),
  relatedJobId: uuid('related_job_id').references(() => jobs.id),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  // Payment details
  amountRequested: decimal('amount_requested', { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal('amount_paid', { precision: 10, scale: 2 }).default('0').notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'paid' | 'partially_paid' | 'expired' | 'cancelled'
  // Stripe integration
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripePaymentLinkId: varchar('stripe_payment_link_id', { length: 255 }),
  stripePaymentLinkUrl: varchar('stripe_payment_link_url', { length: 500 }),
  // Public access
  publicToken: varchar('public_token', { length: 100 }).notNull().unique(),
  // Metadata
  description: text('description'),
  expiresAt: timestamp('expires_at'),
  paidAt: timestamp('paid_at'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
