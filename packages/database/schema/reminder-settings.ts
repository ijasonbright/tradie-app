import { pgTable, uuid, varchar, timestamp, boolean, integer, text } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const reminderSettings = pgTable('reminder_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull().unique(),

  // Invoice Reminders
  invoiceRemindersEnabled: boolean('invoice_reminders_enabled').default(true).notNull(),
  reminderDaysBeforeDue: text('reminder_days_before_due').default('7,3,1'), // Comma-separated days
  reminderDaysAfterDue: text('reminder_days_after_due').default('1,7,14'), // Comma-separated days
  invoiceReminderMethod: varchar('invoice_reminder_method', { length: 20 }).default('email').notNull(), // email/sms/both

  // Escalation: Email first, then SMS after X days overdue
  enableSmsEscalation: boolean('enable_sms_escalation').default(true).notNull(),
  smsEscalationDaysOverdue: integer('sms_escalation_days_overdue').default(14).notNull(),

  // Monthly Statements
  monthlyStatementsEnabled: boolean('monthly_statements_enabled').default(true).notNull(),
  statementDayOfMonth: integer('statement_day_of_month').default(1).notNull(), // 1-28
  statementMethod: varchar('statement_method', { length: 20 }).default('email').notNull(), // email/sms/both
  includeOnlyOutstanding: boolean('include_only_outstanding').default(true).notNull(), // true = only clients with outstanding invoices

  // Template references (nullable for custom templates)
  invoiceReminderEmailTemplateId: uuid('invoice_reminder_email_template_id'),
  invoiceReminderSmsTemplateId: uuid('invoice_reminder_sms_template_id'),
  monthlyStatementEmailTemplateId: uuid('monthly_statement_email_template_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const reminderHistory = pgTable('reminder_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),

  reminderType: varchar('reminder_type', { length: 50 }).notNull(), // invoice_reminder/monthly_statement
  clientId: uuid('client_id').notNull(), // FK to clients
  invoiceId: uuid('invoice_id'), // nullable for monthly statements

  sentVia: varchar('sent_via', { length: 20 }).notNull(), // email/sms
  recipientEmail: varchar('recipient_email', { length: 255 }),
  recipientPhone: varchar('recipient_phone', { length: 50 }),

  status: varchar('status', { length: 20 }).default('sent').notNull(), // sent/failed/delivered
  errorMessage: text('error_message'),

  // For invoice reminders
  daysBeforeDue: integer('days_before_due'), // positive = before, negative = after (overdue)
  invoiceAmount: varchar('invoice_amount', { length: 50 }), // Store as string for display

  // SMS tracking
  creditsUsed: integer('credits_used').default(0),
  smsMessageId: uuid('sms_message_id'), // FK to sms_messages if SMS was sent

  sentAt: timestamp('sent_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
})

// Client-specific reminder preferences (optional feature for future)
export const clientReminderPreferences = pgTable('client_reminder_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  clientId: uuid('client_id').notNull(), // FK to clients

  // Override organization settings
  disableInvoiceReminders: boolean('disable_invoice_reminders').default(false).notNull(),
  disableMonthlyStatements: boolean('disable_monthly_statements').default(false).notNull(),
  preferredReminderMethod: varchar('preferred_reminder_method', { length: 20 }), // null = use org default

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
