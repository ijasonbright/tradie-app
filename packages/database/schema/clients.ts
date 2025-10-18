import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  xeroContactId: varchar('xero_contact_id', { length: 255 }),
  clientType: varchar('client_type', { length: 50 }).notNull(), // residential/commercial
  // Individual or Company
  isCompany: boolean('is_company').default(false),
  companyName: varchar('company_name', { length: 255 }),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  mobile: varchar('mobile', { length: 50 }),
  // Site Address
  siteAddressLine1: varchar('site_address_line1', { length: 255 }),
  siteAddressLine2: varchar('site_address_line2', { length: 255 }),
  siteCity: varchar('site_city', { length: 100 }),
  siteState: varchar('site_state', { length: 50 }),
  sitePostcode: varchar('site_postcode', { length: 20 }),
  // Billing Address
  billingAddressSameAsSite: boolean('billing_address_same_as_site').default(true),
  billingAddressLine1: varchar('billing_address_line1', { length: 255 }),
  billingAddressLine2: varchar('billing_address_line2', { length: 255 }),
  billingCity: varchar('billing_city', { length: 100 }),
  billingState: varchar('billing_state', { length: 50 }),
  billingPostcode: varchar('billing_postcode', { length: 20 }),
  // Business details
  abn: varchar('abn', { length: 50 }),
  notes: text('notes'),
  preferredContactMethod: varchar('preferred_contact_method', { length: 50 }), // email/sms/phone
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const clientContacts = pgTable('client_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
