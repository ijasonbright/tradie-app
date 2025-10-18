import { pgTable, uuid, varchar, text, timestamp, decimal, integer, boolean } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { clients } from './clients'
import { users } from './users'

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  jobNumber: varchar('job_number', { length: 50 }).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
  assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
  // Job details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  jobType: varchar('job_type', { length: 50 }).notNull(), // repair/installation/maintenance/inspection/quote/emergency
  status: varchar('status', { length: 50 }).default('quoted').notNull(), // quoted/scheduled/in_progress/completed/invoiced/cancelled
  priority: varchar('priority', { length: 50 }).default('medium'), // low/medium/high/urgent
  // Location
  siteAddressLine1: varchar('site_address_line1', { length: 255 }),
  siteAddressLine2: varchar('site_address_line2', { length: 255 }),
  siteCity: varchar('site_city', { length: 100 }),
  siteState: varchar('site_state', { length: 50 }),
  sitePostcode: varchar('site_postcode', { length: 20 }),
  siteAccessNotes: text('site_access_notes'),
  // Pricing
  quotedAmount: decimal('quoted_amount', { precision: 10, scale: 2 }),
  actualAmount: decimal('actual_amount', { precision: 10, scale: 2 }),
  // Scheduling
  scheduledDate: timestamp('scheduled_date'),
  scheduledStartTime: timestamp('scheduled_start_time'),
  scheduledEndTime: timestamp('scheduled_end_time'),
  actualStartTime: timestamp('actual_start_time'),
  actualEndTime: timestamp('actual_end_time'),
  completedAt: timestamp('completed_at'),
  // Related records
  quoteId: uuid('quote_id'),
  invoiceId: uuid('invoice_id'),
  xeroQuoteId: varchar('xero_quote_id', { length: 255 }),
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const jobAssignments = pgTable('job_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // primary/assistant
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  removedAt: timestamp('removed_at'),
})

export const jobTimeLogs = pgTable('job_time_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  logType: varchar('log_type', { length: 50 }).notNull(), // manual/timer
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  breakDurationMinutes: integer('break_duration_minutes').default(0),
  totalHours: decimal('total_hours', { precision: 5, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  laborCost: decimal('labor_cost', { precision: 10, scale: 2 }),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('pending'), // pending/approved/rejected
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const jobMaterials = pgTable('job_materials', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  addedByUserId: uuid('added_by_user_id').references(() => users.id).notNull(),
  materialType: varchar('material_type', { length: 50 }).notNull(), // product/part/hire_equipment
  description: varchar('description', { length: 500 }).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(),
  receiptUrl: varchar('receipt_url', { length: 500 }),
  status: varchar('status', { length: 50 }).default('pending'), // pending/approved/rejected
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  allocatedToUserId: uuid('allocated_to_user_id').references(() => users.id), // for subcontractor tracking
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const jobPhotos = pgTable('job_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id).notNull(),
  photoUrl: varchar('photo_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  caption: text('caption'),
  photoType: varchar('photo_type', { length: 50 }), // before/during/after/issue/completion
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
})

export const jobNotes = pgTable('job_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  noteText: text('note_text').notNull(),
  noteType: varchar('note_type', { length: 50 }).default('general'), // general/issue/client_request/internal
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const jobChecklists = pgTable('job_checklists', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  checklistTemplateId: uuid('checklist_template_id'),
  title: varchar('title', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const jobChecklistItems = pgTable('job_checklist_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobChecklistId: uuid('job_checklist_id').references(() => jobChecklists.id).notNull(),
  itemText: varchar('item_text', { length: 500 }).notNull(),
  isCompleted: boolean('is_completed').default(false),
  completedByUserId: uuid('completed_by_user_id').references(() => users.id),
  completedAt: timestamp('completed_at'),
  itemOrder: integer('item_order').notNull(),
})
