import { pgTable, uuid, varchar, text, timestamp, integer, decimal } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { properties } from './properties'

// Asset categories matching Property Pal
export const ASSET_CATEGORIES = [
  'APPLIANCE',
  'HVAC',
  'PLUMBING',
  'ELECTRICAL',
  'SECURITY',
  'FURNITURE',
  'FIXTURE',
  'OTHER',
] as const

// Asset conditions matching Property Pal
export const ASSET_CONDITIONS = [
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'REPLACEMENT_NEEDED',
] as const

// Warranty statuses matching Property Pal
export const WARRANTY_STATUSES = [
  'IN_WARRANTY',
  'EXPIRED',
  'UNKNOWN',
  'NOT_APPLICABLE',
] as const

// Maintenance requirements matching Property Pal
export const MAINTENANCE_OPTIONS = [
  'NONE',
  'ROUTINE',
  'REPAIR',
  'REPLACEMENT',
] as const

// Assets table - for capturing and managing property assets
export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  propertyId: uuid('property_id').references(() => properties.id).notNull(),

  // Basic info
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull().default('OTHER'),
  brand: varchar('brand', { length: 255 }),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 255 }),

  // Location
  room: varchar('room', { length: 100 }),
  location: varchar('location', { length: 255 }), // Specific location within room

  // Condition & status
  condition: varchar('condition', { length: 50 }).notNull().default('GOOD'),
  estimatedAge: integer('estimated_age'), // Years
  warrantyStatus: varchar('warranty_status', { length: 50 }),
  warrantyExpiry: timestamp('warranty_expiry'),
  maintenanceRequired: varchar('maintenance_required', { length: 50 }).default('NONE'),

  // Value & replacement
  currentValue: decimal('current_value', { precision: 10, scale: 2 }),
  replacementCost: decimal('replacement_cost', { precision: 10, scale: 2 }),
  expectedLifespanYears: integer('expected_lifespan_years'),
  yearsRemaining: decimal('years_remaining', { precision: 5, scale: 2 }),
  replacementYear: integer('replacement_year'),

  // Notes
  notes: text('notes'),

  // External reference to Property Pal
  externalAssetId: integer('external_asset_id'),
  syncedAt: timestamp('synced_at'),

  // Captured by (user who recorded this asset)
  capturedById: uuid('captured_by_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Asset photos table
export const assetPhotos = pgTable('asset_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),

  // Photo details
  photoPath: varchar('photo_path', { length: 500 }).notNull(),
  thumbnailPath: varchar('thumbnail_path', { length: 500 }),
  photoType: varchar('photo_type', { length: 50 }).default('general'), // general, condition, serial, label
  caption: text('caption'),

  // Metadata
  takenAt: timestamp('taken_at').defaultNow(),
  uploadedById: uuid('uploaded_by_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
})
