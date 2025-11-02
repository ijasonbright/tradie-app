import { pgTable, uuid, varchar, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'

export const tallbobWebhooks = pgTable('tallbob_webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  webhookType: varchar('webhook_type', { length: 50 }).notNull(), // 'delivery_status' | 'inbound_message'
  tallbobMessageId: varchar('tallbob_message_id', { length: 255 }),
  payload: jsonb('payload').notNull(), // Full webhook payload
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
