import { pgTable, uuid, varchar, text, timestamp, integer, decimal } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'
import { invoices } from './invoices'
import { quotes } from './quotes'
import { jobs } from './jobs'

export const smsTransactions = pgTable('sms_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(), // 'purchase' | 'usage' | 'adjustment' | 'refund'
  creditsAmount: integer('credits_amount').notNull(), // Positive for add, negative for deduct
  costAmount: decimal('cost_amount', { precision: 10, scale: 2 }), // In dollars (e.g., 5.00 for $5)
  balanceAfter: integer('balance_after').notNull(), // Credits remaining after this transaction
  description: text('description'),

  // For usage transactions (when SMS sent)
  recipientPhone: varchar('recipient_phone', { length: 50 }),
  senderUserId: uuid('sender_user_id').references(() => users.id),
  smsType: varchar('sms_type', { length: 50 }), // 'invoice' | 'quote' | 'reminder' | 'reply' | 'notification'
  messagePreview: text('message_preview'), // First 50 chars of message
  tallbobMessageId: varchar('tallbob_message_id', { length: 255 }),
  deliveryStatus: varchar('delivery_status', { length: 50 }), // 'pending' | 'sent' | 'delivered' | 'failed'

  // Related records
  relatedInvoiceId: uuid('related_invoice_id').references(() => invoices.id),
  relatedQuoteId: uuid('related_quote_id').references(() => quotes.id),
  relatedJobId: uuid('related_job_id').references(() => jobs.id),

  // For purchase transactions
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
})
