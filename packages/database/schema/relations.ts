import { relations } from 'drizzle-orm'
import { organizations } from './organizations'
import { users } from './users'
import { organizationMembers, userDocuments } from './organization-members'
import { clients, clientContacts } from './clients'
import {
  jobs,
  jobAssignments,
  jobTimeLogs,
  jobMaterials,
  jobPhotos,
  jobNotes,
  jobChecklists,
  jobChecklistItems,
} from './jobs'
import { quotes, quoteLineItems } from './quotes'
import { invoices, invoiceLineItems, invoicePayments } from './invoices'

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  organizationMemberships: many(organizationMembers),
  documents: many(userDocuments),
  ownedOrganizations: many(organizations),
  createdClients: many(clients),
  createdJobs: many(jobs),
  assignedJobs: many(jobs),
  jobAssignments: many(jobAssignments),
  timeLogs: many(jobTimeLogs),
  addedMaterials: many(jobMaterials),
  uploadedPhotos: many(jobPhotos),
  jobNotes: many(jobNotes),
  createdQuotes: many(quotes),
  createdInvoices: many(invoices),
}))

// Organization relations
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  members: many(organizationMembers),
  clients: many(clients),
  jobs: many(jobs),
  quotes: many(quotes),
  invoices: many(invoices),
}))

// Organization members relations
export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}))

// Client relations
export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [clients.createdByUserId],
    references: [users.id],
  }),
  contacts: many(clientContacts),
  jobs: many(jobs),
  quotes: many(quotes),
  invoices: many(invoices),
}))

// Job relations
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobs.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [jobs.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [jobs.createdByUserId],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [jobs.assignedToUserId],
    references: [users.id],
  }),
  assignments: many(jobAssignments),
  timeLogs: many(jobTimeLogs),
  materials: many(jobMaterials),
  photos: many(jobPhotos),
  notes: many(jobNotes),
  checklists: many(jobChecklists),
}))

// Quote relations
export const quotesRelations = relations(quotes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [quotes.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [quotes.createdByUserId],
    references: [users.id],
  }),
  lineItems: many(quoteLineItems),
  convertedJob: one(jobs, {
    fields: [quotes.convertedToJobId],
    references: [jobs.id],
  }),
}))

// Invoice relations
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  createdBy: one(users, {
    fields: [invoices.createdByUserId],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
  payments: many(invoicePayments),
}))
