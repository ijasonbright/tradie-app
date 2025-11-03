import { pgTable, uuid, decimal, timestamp, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'
import { organizations } from './organizations'

export const teamMemberLocations = pgTable('team_member_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal('accuracy', { precision: 10, scale: 2 }), // Accuracy in meters
  heading: decimal('heading', { precision: 5, scale: 2 }), // Direction in degrees (0-360)
  speed: decimal('speed', { precision: 10, scale: 2 }), // Speed in meters per second
  altitude: decimal('altitude', { precision: 10, scale: 2 }), // Altitude in meters
  isActive: boolean('is_active').default(true).notNull(), // Is location sharing enabled
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
