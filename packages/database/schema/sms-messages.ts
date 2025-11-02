import { pgTable, uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { smsConversations } from './sms-conversations'
import { organizations } from './organizations'
import { users } from './users'
import { jobs } from './jobs'
import { invoices } from './invoices'
import { quotes } from './quotes'

export const smsMessages = pgTable('sms_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => smsConversations.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 20 }).notNull(), // 'inbound' | 'outbound'
  senderUserId: uuid('sender_user_id').references(() => users.id), // For outbound messages
  recipientPhone: varchar('recipient_phone', { length: 50 }),
  senderPhone: varchar('sender_phone', { length: 50 }),
  messageBody: text('message_body').notNull(),
  characterCount: integer('character_count').notNull(),
  creditsUsed: integer('credits_used'), // For outbound messages
  tallbobMessageId: varchar('tallbob_message_id', { length: 255 }),
  status: varchar('status', { length: 50 }), // 'pending' | 'sent' | 'delivered' | 'failed' | 'received'

  // Context - what triggered this message
  jobId: uuid('job_id').references(() => jobs.id),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  quoteId: uuid('quote_id').references(() => quotes.id),

  // Timestamps
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
