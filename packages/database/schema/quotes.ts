import { pgTable, uuid, varchar, text, timestamp, decimal, integer, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { clients } from './clients'
import { users } from './users'
import { jobs } from './jobs'

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  quoteNumber: varchar('quote_number', { length: 50 }).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // draft/sent/accepted/rejected/expired
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  validUntilDate: timestamp('valid_until_date').notNull(),
  sentAt: timestamp('sent_at'),
  acceptedAt: timestamp('accepted_at'),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),
  convertedToJobId: uuid('converted_to_job_id').references(() => jobs.id),
  notes: text('notes'),
  xeroQuoteId: varchar('xero_quote_id', { length: 255 }),
  // Deposit fields
  depositRequired: boolean('deposit_required').default(false).notNull(),
  depositPercentage: decimal('deposit_percentage', { precision: 5, scale: 2 }), // e.g., 30.00 for 30%
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }), // Fixed deposit amount
  depositPaid: boolean('deposit_paid').default(false).notNull(),
  depositPaidAt: timestamp('deposit_paid_at'),
  depositPaymentIntentId: varchar('deposit_payment_intent_id', { length: 255 }),
  depositPaymentLinkUrl: varchar('deposit_payment_link_url', { length: 500 }),
  // Public viewing and acceptance
  publicToken: varchar('public_token', { length: 100 }).unique(),
  acceptedByName: varchar('accepted_by_name', { length: 255 }),
  acceptedByEmail: varchar('accepted_by_email', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const quoteLineItems = pgTable('quote_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteId: uuid('quote_id').references(() => quotes.id).notNull(),
  itemType: varchar('item_type', { length: 50 }).notNull(), // labor/material/equipment/other
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal('line_total', { precision: 10, scale: 2 }).notNull(),
  lineOrder: integer('line_order').notNull(),
})
