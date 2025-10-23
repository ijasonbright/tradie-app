import { pgTable, uuid, varchar, timestamp, boolean, decimal } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // owner/admin/employee/subcontractor
  status: varchar('status', { length: 50 }).default('invited').notNull(), // invited/active/suspended
  invitationToken: varchar('invitation_token', { length: 255 }).unique(),
  invitationSentAt: timestamp('invitation_sent_at'),
  invitationAcceptedAt: timestamp('invitation_accepted_at'),
  // Rates and employment
  employmentType: varchar('employment_type', { length: 50 }).default('employee'), // employee/subcontractor
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }), // Cost rate (what you pay them)
  billingRate: decimal('billing_rate', { precision: 10, scale: 2 }), // Rate charged to clients
  owedAmount: decimal('owed_amount', { precision: 10, scale: 2 }).default('0'),
  leaveBalanceHours: decimal('leave_balance_hours', { precision: 10, scale: 2 }).default('0'),
  availableForScheduling: boolean('available_for_scheduling').default(true),
  // Permissions
  canCreateJobs: boolean('can_create_jobs').default(false),
  canEditAllJobs: boolean('can_edit_all_jobs').default(false),
  canCreateInvoices: boolean('can_create_invoices').default(false),
  canViewFinancials: boolean('can_view_financials').default(false),
  canApproveExpenses: boolean('can_approve_expenses').default(false),
  canApproveTimesheets: boolean('can_approve_timesheets').default(false),
  joinedAt: timestamp('joined_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userDocuments = pgTable('user_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  documentType: varchar('document_type', { length: 100 }).notNull(), // license/certification/insurance/white_card/etc
  documentCategory: varchar('document_category', { length: 50 }), // license, insurance, certification, other
  title: varchar('title', { length: 255 }).notNull(),
  documentNumber: varchar('document_number', { length: 100 }),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  issueDate: timestamp('issue_date'),
  expiryDate: timestamp('expiry_date'), // User-entered expiry date
  issuingAuthority: varchar('issuing_authority', { length: 255 }),
  // Admin verification
  verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  verificationNotes: varchar('verification_notes', { length: 500 }),
  // AI verification
  aiVerificationStatus: varchar('ai_verification_status', { length: 50 }), // pending, verified, mismatch, error
  aiVerificationNotes: varchar('ai_verification_notes', { length: 500 }),
  aiExtractedExpiryDate: timestamp('ai_extracted_expiry_date'), // AI-extracted date from document
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
