import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'
import { jobs } from './jobs'
import { clients } from './clients'

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  appointmentType: varchar('appointment_type', { length: 50 }).notNull(), // job/quote/meeting/site_visit/admin/personal
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  allDay: boolean('all_day').default(false),

  // Relations
  jobId: uuid('job_id').references(() => jobs.id),
  clientId: uuid('client_id').references(() => clients.id),
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.id).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),

  // Location
  locationAddress: text('location_address'),

  // Reminders
  reminderMinutesBefore: varchar('reminder_minutes_before', { length: 50 }), // 15/30/60/1440 (1 day)
  reminderSentAt: timestamp('reminder_sent_at'),

  // Recurrence (future feature)
  isRecurring: boolean('is_recurring').default(false),
  recurrenceRule: text('recurrence_rule'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
