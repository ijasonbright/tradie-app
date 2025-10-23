import { pgTable, uuid, varchar, decimal, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const tradeTypes = pgTable('trade_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  clientHourlyRate: decimal('client_hourly_rate', { precision: 10, scale: 2 }).default('0').notNull(),
  clientDailyRate: decimal('client_daily_rate', { precision: 10, scale: 2 }),
  defaultEmployeeCost: decimal('default_employee_cost', { precision: 10, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueOrgName: unique().on(table.organizationId, table.name),
}))
