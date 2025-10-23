import { pgTable, uuid, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const teamMemberUnavailability = pgTable('team_member_unavailability', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  unavailabilityType: varchar('unavailability_type', { length: 50 }).notNull(), // annual_leave/sick_leave/rostered_off/public_holiday/other
  startDatetime: timestamp('start_datetime').notNull(),
  endDatetime: timestamp('end_datetime').notNull(),
  allDay: boolean('all_day').default(false),
  notes: text('notes'),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  status: varchar('status', { length: 50 }).default('pending'), // pending/approved/rejected
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
