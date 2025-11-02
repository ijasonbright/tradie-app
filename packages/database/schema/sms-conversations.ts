import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { clients } from './clients'

export const smsConversations = pgTable('sms_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(), // The client/recipient number
  clientId: uuid('client_id').references(() => clients.id), // Optional link to client
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
