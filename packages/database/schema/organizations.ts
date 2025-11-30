import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal } from 'drizzle-orm/pg-core'
import { users } from './users'

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  abn: varchar('abn', { length: 50 }),
  tradeType: varchar('trade_type', { length: 100 }),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }), // Hex color code (e.g., #1E40AF)
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  postcode: varchar('postcode', { length: 20 }),
  ownerId: uuid('owner_id').references(() => users.id),
  smsCredits: integer('sms_credits').default(0).notNull(),
  smsPhoneNumber: varchar('sms_phone_number', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('none'),
  subscriptionPlan: varchar('subscription_plan', { length: 50 }).default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  xeroConnected: boolean('xero_connected').default(false),
  // Bank details for invoices
  bankName: varchar('bank_name', { length: 100 }),
  bankBsb: varchar('bank_bsb', { length: 10 }),
  bankAccountNumber: varchar('bank_account_number', { length: 50 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  // Business rates
  defaultHourlyRate: decimal('default_hourly_rate', { precision: 10, scale: 2 }).default('0'),
  defaultEmployeeCost: decimal('default_employee_cost', { precision: 10, scale: 2 }).default('0'),
  // External integration (Property Pal)
  externalAgencyId: integer('external_agency_id'),
  externalSource: varchar('external_source', { length: 50 }), // 'property_pal'
  externalSyncedAt: timestamp('external_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
