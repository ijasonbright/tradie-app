import { pgTable, uuid, varchar, decimal, boolean, timestamp, unique, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const tradeTypes = pgTable('trade_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  jobTypeId: integer('job_type_id'),
  name: varchar('name', { length: 100 }).notNull(),
  // Client billing rates
  clientHourlyRate: decimal('client_hourly_rate', { precision: 10, scale: 2 }).default('0').notNull(),
  clientFirstHourRate: decimal('client_first_hour_rate', { precision: 10, scale: 2 }),
  clientCalloutFee: decimal('client_callout_fee', { precision: 10, scale: 2 }).default('0'),
  clientAfterHoursCalloutFee: decimal('client_after_hours_callout_fee', { precision: 10, scale: 2 }).default('0'),
  clientAfterHoursExtraPercent: decimal('client_after_hours_extra_percent', { precision: 5, scale: 2 }).default('0'),
  // Employee/Contractor default costs
  defaultEmployeeHourlyRate: decimal('default_employee_hourly_rate', { precision: 10, scale: 2 }).default('0'),
  defaultEmployeeDailyRate: decimal('default_employee_daily_rate', { precision: 10, scale: 2 }),
  // Deprecated fields (kept for backward compatibility)
  clientDailyRate: decimal('client_daily_rate', { precision: 10, scale: 2 }),
  defaultEmployeeCost: decimal('default_employee_cost', { precision: 10, scale: 2 }).default('0'),
  // Status
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueOrgJobType: unique().on(table.organizationId, table.jobTypeId),
}))
