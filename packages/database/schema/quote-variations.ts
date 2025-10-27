import { pgTable, uuid, varchar, text, timestamp, decimal, integer } from 'drizzle-orm/pg-core'
import { jobs } from './jobs'
import { organizations } from './organizations'
import { users } from './users'

export const quoteVariations = pgTable('quote_variations', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteId: uuid('quote_id').notNull(), // Reference to quotes table
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  variationNumber: varchar('variation_number', { length: 50 }).notNull(), // VAR-001, VAR-002
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending/approved/rejected
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).default('0').notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
  approvedByClientAt: timestamp('approved_by_client_at'),
  rejectedByClientAt: timestamp('rejected_by_client_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const quoteVariationLineItems = pgTable('quote_variation_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  variationId: uuid('variation_id').references(() => quoteVariations.id).notNull(),
  itemType: varchar('item_type', { length: 50 }).notNull(), // labor/material/equipment/other
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).default('0').notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  lineTotal: decimal('line_total', { precision: 10, scale: 2 }).default('0').notNull(),
  lineOrder: integer('line_order').default(0).notNull(),
})
