import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const tradieconnectConnections = pgTable('tradieconnect_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  userId: uuid('user_id').notNull(),
  tcUserId: varchar('tc_user_id', { length: 255 }).notNull(), // TradieConnect user GUID
  tcToken: text('tc_token').notNull(), // Encrypted access token
  tcRefreshToken: text('tc_refresh_token'), // Encrypted refresh token
  tcTokenExpiresAt: timestamp('tc_token_expires_at'),
  isActive: boolean('is_active').default(true),
  connectedAt: timestamp('connected_at').defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
