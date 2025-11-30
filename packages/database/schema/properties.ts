import { pgTable, uuid, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

// Properties synced from Property Pal
export const properties = pgTable('properties', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  // External reference to Property Pal
  externalPropertyId: integer('external_property_id').notNull(),

  // Address fields
  addressStreet: varchar('address_street', { length: 255 }),
  addressSuburb: varchar('address_suburb', { length: 100 }),
  addressState: varchar('address_state', { length: 50 }),
  addressPostcode: varchar('address_postcode', { length: 10 }),

  // Property details
  propertyType: varchar('property_type', { length: 50 }), // house, unit, apartment, etc.
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),

  // Owner/tenant info (synced from Property Pal)
  ownerName: varchar('owner_name', { length: 255 }),
  ownerPhone: varchar('owner_phone', { length: 50 }),
  ownerEmail: varchar('owner_email', { length: 255 }),
  tenantName: varchar('tenant_name', { length: 255 }),
  tenantPhone: varchar('tenant_phone', { length: 50 }),
  tenantEmail: varchar('tenant_email', { length: 255 }),

  // Notes
  accessInstructions: text('access_instructions'),
  notes: text('notes'),

  // Sync metadata
  syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
