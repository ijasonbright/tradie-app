import { pgTable, uuid, varchar, text, timestamp, decimal, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { clients } from './clients'
import { users } from './users'
import { jobs } from './jobs'

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
  status: varchar('status', { length: 50 }).default('draft').notNull(), // draft/sent/paid/partially_paid/overdue/cancelled
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0'),
  issueDate: timestamp('issue_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  paidDate: timestamp('paid_date'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  paymentMethod: varchar('payment_method', { length: 50 }), // cash/card/bank_transfer/stripe/other
  notes: text('notes'),
  footerText: text('footer_text'),
  // Xero sync
  xeroInvoiceId: varchar('xero_invoice_id', { length: 255 }),
  lastSyncedAt: timestamp('last_synced_at'),
  // Stripe (future online payments)
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  sourceType: varchar('source_type', { length: 50 }), // job_time_log/job_material/manual
  sourceId: uuid('source_id'), // references time log or material
  itemType: varchar('item_type', { length: 50 }).notNull(), // labor/material/equipment/fee/other
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal('line_total', { precision: 10, scale: 2 }).notNull(),
  lineOrder: integer('line_order').notNull(),
})

export const invoicePayments = pgTable('invoice_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  paymentDate: timestamp('payment_date').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // cash/card/bank_transfer/stripe
  referenceNumber: varchar('reference_number', { length: 100 }),
  notes: text('notes'),
  recordedByUserId: uuid('recorded_by_user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
