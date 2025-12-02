import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { properties } from './properties'
import { users } from './users'
import { completionFormTemplates } from './completion-forms'

// Asset Register Job statuses matching Property Pal
export const ASSET_REGISTER_JOB_STATUSES = [
  'CREATED',
  'ASSIGNED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const

// Asset Register Job priorities matching Property Pal
export const ASSET_REGISTER_JOB_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
] as const

// Asset Register Jobs table - for managing asset register requests from Property Pal
export const assetRegisterJobs = pgTable('asset_register_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  propertyId: uuid('property_id').references(() => properties.id).notNull(),

  // Assignment
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),

  // Status & Priority
  status: varchar('status', { length: 50 }).notNull().default('CREATED'),
  priority: varchar('priority', { length: 50 }).default('MEDIUM'),

  // Dates
  scheduledDate: timestamp('scheduled_date'),
  startedDate: timestamp('started_date'),
  completedDate: timestamp('completed_date'),

  // Notes
  notes: text('notes'),
  completionNotes: text('completion_notes'),

  // Report data (JSON for flexible form data from completion)
  reportData: jsonb('report_data'),

  // External reference to Property Pal
  externalRequestId: integer('external_request_id'), // Property Pal asset_register_request_id
  externalSource: varchar('external_source', { length: 50 }).default('property_pal'),
  externalSyncedAt: timestamp('external_synced_at'),
  externalPropertyId: integer('external_property_id'), // Property Pal property_id

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Asset Register Job Photos table
export const assetRegisterJobPhotos = pgTable('asset_register_job_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetRegisterJobId: uuid('asset_register_job_id').references(() => assetRegisterJobs.id, { onDelete: 'cascade' }).notNull(),

  // Photo details
  photoUrl: varchar('photo_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  photoType: varchar('photo_type', { length: 50 }).default('general'), // general, condition, completion
  caption: text('caption'),

  // Context (room/item)
  room: varchar('room', { length: 100 }),
  item: varchar('item', { length: 255 }),

  // Metadata
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
  takenAt: timestamp('taken_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Asset Register Job Notes table
export const assetRegisterJobNotes = pgTable('asset_register_job_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetRegisterJobId: uuid('asset_register_job_id').references(() => assetRegisterJobs.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),

  noteText: text('note_text').notNull(),
  noteType: varchar('note_type', { length: 50 }).default('general'), // general/issue/internal

  createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Asset Register Completion Forms
 * Completed form instances linked to asset register jobs
 * Uses the same template system as job completion forms
 */
export const assetRegisterCompletionForms = pgTable('asset_register_completion_forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  assetRegisterJobId: uuid('asset_register_job_id').references(() => assetRegisterJobs.id, { onDelete: 'cascade' }).notNull(),
  templateId: uuid('template_id').references(() => completionFormTemplates.id),

  // Form completion
  completedByUserId: uuid('completed_by_user_id').references(() => users.id).notNull(),
  completionDate: timestamp('completion_date'),

  // Form data - uses JSONB for flexible form data storage
  formData: jsonb('form_data').notNull(), // {[questionId]: answer, ...}

  // Signatures
  clientSignatureUrl: varchar('client_signature_url', { length: 500 }),
  technicianSignatureUrl: varchar('technician_signature_url', { length: 500 }),
  clientName: varchar('client_name', { length: 255 }),
  technicianName: varchar('technician_name', { length: 255 }),

  // PDF generation
  pdfUrl: varchar('pdf_url', { length: 500 }),
  pdfGeneratedAt: timestamp('pdf_generated_at'),

  // Status
  status: varchar('status', { length: 50 }).default('draft').notNull(), // draft/submitted/sent_to_client
  sentToClient: boolean('sent_to_client').default(false),
  sentAt: timestamp('sent_at'),

  // Sync to Property Pal
  syncedToPropertyPal: boolean('synced_to_property_pal').default(false),
  syncedAt: timestamp('synced_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Asset Register Form Access Tokens
 * For mobile web access without Tradie App login
 * Similar to maintenance form tokens in Property Pal
 */
export const assetRegisterFormTokens = pgTable('asset_register_form_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetRegisterJobId: uuid('asset_register_job_id').references(() => assetRegisterJobs.id, { onDelete: 'cascade' }).notNull(),

  // Token for URL access
  token: varchar('token', { length: 255 }).notNull().unique(),

  // Token validity
  expiresAt: timestamp('expires_at').notNull(),
  isUsed: boolean('is_used').default(false),
  usedAt: timestamp('used_at'),
  usedByEmail: varchar('used_by_email', { length: 255 }),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
