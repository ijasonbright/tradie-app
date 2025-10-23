import { pgTable, uuid, varchar, text, timestamp, decimal } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'
import { jobs } from './jobs'

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(), // who incurred it
  jobId: uuid('job_id').references(() => jobs.id), // optional allocation

  category: varchar('category', { length: 100 }).notNull(), // fuel/materials/tools/vehicle/subcontractor/meals/other
  supplierName: varchar('supplier_name', { length: 255 }), // supplier/vendor name
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  gstAmount: decimal('gst_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),

  receiptUrl: text('receipt_url'), // Vercel Blob URL
  expenseDate: timestamp('expense_date').notNull(),

  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending/approved/rejected/reimbursed
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  reimbursedAt: timestamp('reimbursed_at'),

  // Xero sync
  xeroExpenseId: varchar('xero_expense_id', { length: 255 }),
  xeroAccountCode: varchar('xero_account_code', { length: 50 }), // Xero account code for categorization
  lastSyncedAt: timestamp('last_synced_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
