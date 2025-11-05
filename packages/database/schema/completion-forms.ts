import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'
import { jobs } from './jobs'

/**
 * Completion Form Templates
 * Defines reusable form templates for different job types
 * Examples: "Plumbing Installation Report", "Electrical Safety Check", "HVAC Maintenance"
 */
export const completionFormTemplates = pgTable('completion_form_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),

  // Template metadata
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  code: varchar('code', { length: 100 }), // unique code for template (e.g., "rentsafe_inspection")

  // Assignment and usage
  jobType: varchar('job_type', { length: 50 }), // Optional: auto-assign to job types
  isGlobal: boolean('is_global').default(false), // Global templates available to all orgs
  isActive: boolean('is_active').default(true),

  // Form configuration
  navigationType: varchar('navigation_type', { length: 50 }).default('tabs'), // tabs/accordion/wizard/dropdown
  includePhotos: boolean('include_photos').default(true),
  includeBeforeAfterPhotos: boolean('include_before_after_photos').default(true),
  includeSignature: boolean('include_signature').default(true), // Client signature
  includeTechnicianSignature: boolean('include_technician_signature').default(true),

  // Legacy field mappings from CSV
  siteId: integer('site_id'), // From original CSV
  csvJobTypeId: integer('csv_job_type_id'), // From original CSV
  csvFormTypeId: integer('csv_form_type_id'), // From original CSV (1 = completion, 0 = edit)
  siteGroupId: integer('site_group_id'), // From original CSV

  // Metadata
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Completion Form Template Groups (Sections)
 * Groups/sections within a form template
 * Examples: "Work Performed", "Safety Compliance", "Materials Used"
 */
export const completionFormTemplateGroups = pgTable('completion_form_template_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').references(() => completionFormTemplates.id, { onDelete: 'cascade' }).notNull(),

  // Group metadata
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull(),

  // Display configuration
  isCollapsible: boolean('is_collapsible').default(true), // For accordion navigation
  isCompletionGroup: boolean('is_completion_group').default(false), // Special group for completion details

  // Conditional display
  conditionalLogic: jsonb('conditional_logic'), // {enabled: boolean, rules: [...], logic: 'and'|'or'}

  // Legacy field from CSV
  csvGroupId: integer('csv_group_id'), // From original CSV JobTypeFormGroupId

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Completion Form Template Questions
 * Individual questions/fields within form groups
 * Supports multiple field types: text, textarea, dropdown, radio, checkbox, file, signature, etc.
 */
export const completionFormTemplateQuestions = pgTable('completion_form_template_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').references(() => completionFormTemplates.id, { onDelete: 'cascade' }).notNull(),
  groupId: uuid('group_id').references(() => completionFormTemplateGroups.id, { onDelete: 'cascade' }).notNull(),

  // Question metadata
  questionText: text('question_text').notNull(),
  placeholder: varchar('placeholder', { length: 255 }),
  helpText: text('help_text'),
  helpUrl: varchar('help_url', { length: 500 }),
  defaultValue: text('default_value'),

  // Field type and configuration
  fieldType: varchar('field_type', { length: 50 }).notNull(), // text/textarea/number/email/phone/date/time/datetime/dropdown/radio/checkbox/multi_checkbox/file/signature/address/hidden/html/rating/iscompliant
  config: jsonb('config'), // Field-specific configuration (file types, size limits, validation rules, etc.)

  // Validation
  isRequired: boolean('is_required').default(false),
  validationMessage: text('validation_message'),
  validationRules: jsonb('validation_rules'), // {min, max, pattern, etc.}

  // Display
  sortOrder: integer('sort_order').notNull(),
  columnSpan: integer('column_span').default(1), // For multi-column layouts (1-12)

  // Conditional logic
  conditionalLogic: jsonb('conditional_logic'), // {enabled: boolean, rules: [...], logic: 'and'|'or'}

  // Answer options (for dropdown, radio, multi-checkbox)
  answerOptions: jsonb('answer_options'), // [{id, text, sortOrder, colorCode, actionsRequired}, ...]

  // Legacy fields from CSV
  csvQuestionId: integer('csv_question_id'), // From original CSV JobTypeFormQuestionId
  csvGroupNo: integer('csv_group_no'), // From original CSV GroupNo
  csvField: varchar('csv_field', { length: 255 }), // From original CSV Field

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Job Completion Forms (Completed Instances)
 * Completed form instances linked to specific jobs
 * Contains all submitted answers in JSONB format
 */
export const jobCompletionForms = pgTable('job_completion_forms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  templateId: uuid('template_id').references(() => completionFormTemplates.id).notNull(),

  // Form completion
  completedByUserId: uuid('completed_by_user_id').references(() => users.id).notNull(),
  completionDate: timestamp('completion_date'),

  // Form data
  formData: jsonb('form_data').notNull(), // {[questionId]: answer, ...}

  // Signatures
  clientSignatureUrl: varchar('client_signature_url', { length: 500 }),
  technicianSignatureUrl: varchar('technician_signature_url', { length: 500 }),
  clientName: varchar('client_name', { length: 255 }), // Name signed by client
  technicianName: varchar('technician_name', { length: 255 }), // Name signed by technician

  // PDF generation
  pdfUrl: varchar('pdf_url', { length: 500 }),
  pdfGeneratedAt: timestamp('pdf_generated_at'),

  // Status and delivery
  status: varchar('status', { length: 50 }).default('draft').notNull(), // draft/submitted/sent_to_client
  sentToClient: boolean('sent_to_client').default(false),
  sentAt: timestamp('sent_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Job Completion Form Photos
 * Photos specific to completion forms
 * Links photos to specific questions (e.g., "Photo of completed work")
 */
export const jobCompletionFormPhotos = pgTable('job_completion_form_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  completionFormId: uuid('completion_form_id').references(() => jobCompletionForms.id, { onDelete: 'cascade' }).notNull(),
  questionId: uuid('question_id').references(() => completionFormTemplateQuestions.id),

  // Photo details
  photoUrl: varchar('photo_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  caption: text('caption'),
  photoType: varchar('photo_type', { length: 50 }), // before/during/after/issue/completion/general

  // Display order
  sortOrder: integer('sort_order').default(0),

  // Metadata
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
})

/**
 * Job Completion Form Answers (Normalized)
 * Individual answer rows - matches SQL Server structure for easy data export
 * This provides a normalized view of answers (alternative to JSONB form_data)
 */
export const jobCompletionFormAnswers = pgTable('job_completion_form_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  completionFormId: uuid('completion_form_id').references(() => jobCompletionForms.id, { onDelete: 'cascade' }).notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),

  // Question reference
  questionId: uuid('question_id').references(() => completionFormTemplateQuestions.id).notNull(),

  // Answer reference (for choice-based questions)
  answerId: varchar('answer_id', { length: 100 }), // References answer_options[].id in question

  // Answer value (text, number, date, etc.)
  value: text('value'), // The actual answer value
  valueNumeric: integer('value_numeric'), // For numeric answers

  // File upload fields (matches SQL Server structure)
  fileCategory: varchar('file_category', { length: 100 }),
  filePath: varchar('file_path', { length: 500 }),
  fileRef: varchar('file_ref', { length: 255 }),
  fileSuffix: varchar('file_suffix', { length: 50 }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),

  // Submission metadata
  submissionTypeId: integer('submission_type_id').default(0),

  // Legacy CSV IDs for reference
  csvQuestionId: integer('csv_question_id'), // Original CSV question ID
  csvAnswerId: integer('csv_answer_id'), // Original CSV answer ID

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
