Complete Project Scope: Multi-Tenant Tradie Business Management App
Executive Summary
A cross-platform mobile application for tradespeople to manage their business operations, designed to build a large user network with a free or cost-covering pricing model. The app features multi-tenancy, team management, job tracking, invoicing, two-way SMS communication, subcontractor payment tracking, and comprehensive Xero integration.
Target Market: Solo tradies and small trade businesses (1-10 employees) in Australia/New Zealand initially, expandable globally.
Business Model: Free or minimal subscription to cover infrastructure costs. SMS charged at cost (5¢ per 160 characters).
Core Value: Replace multiple apps and paperwork with one comprehensive tool accessible from mobile devices on-site.

Technical Stack
Mobile Application

Framework: React Native with Expo (managed workflow)
Language: TypeScript (strict mode)
State Management: Zustand (global state) + React Query (server state)
Forms: React Hook Form + Zod validation
Navigation: React Navigation 6
UI Components: React Native Paper or NativeBase
Camera/Files: Expo Camera, Document Picker, Image Picker

Backend & API

Framework: Next.js 14+ (App Router)
Runtime: Vercel serverless functions
API Design: RESTful with tRPC for type safety
Validation: Zod schemas (shared between frontend/backend)
Authentication: Clerk with Organizations support

Database

Database: Neon PostgreSQL (serverless)
ORM: Drizzle ORM
Migrations: Drizzle Kit
Security: Row Level Security (RLS) for multi-tenancy

Storage & Assets

Files: Vercel Blob Storage
Image Processing: Sharp

External Integrations

Accounting: Xero API (contacts, invoices, expenses, bills)
Payments: Stripe (SMS credit purchases, future subscriptions)
SMS: Tall Bob API (two-way SMS)
Email: Resend or SendGrid
Maps: Google Maps API (for addresses)

Development Environment

IDE: VS Code with Claude extension
Version Control: Git
Deployment: Vercel (backend), EAS Build (mobile)
Package Manager: npm or pnpm

## CRITICAL: API Development Patterns & Troubleshooting

### Mobile API Authentication Pattern

**IMPORTANT:** When creating new API endpoints that need to be accessed by the mobile app, you MUST follow these patterns exactly:

#### 1. Database Queries: Use Raw Neon SQL (NOT Drizzle ORM)

**WHY:** Drizzle ORM tries to connect to the database at build time, causing build failures on Vercel with "Database connection string format" errors.

**CORRECT Pattern:**
```typescript
import { neon } from '@neondatabase/serverless'

export async function GET(request: NextRequest) {
  const sql = neon(process.env.DATABASE_URL!)

  const results = await sql`
    SELECT * FROM jobs WHERE id = ${jobId}
  `

  return NextResponse.json(results[0])
}
```

**WRONG Pattern (DO NOT USE):**
```typescript
import { db } from '@tradie-app/database'
import { jobs } from '@tradie-app/database'

export async function GET(request: NextRequest) {
  const results = await db.select().from(jobs).where(eq(jobs.id, jobId))
  // ❌ This will fail at build time!
}
```

**Note:** Drizzle ORM is ONLY used for schema definitions in `/packages/database/schema/`. All API routes MUST use raw Neon SQL.

#### 2. Dual Authentication: Clerk (Web) + JWT (Mobile)

All mobile API endpoints must support BOTH authentication methods:

```typescript
import { auth } from '@clerk/nextjs/server'
import { extractTokenFromHeader, verifyMobileToken } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  // Try Clerk auth first (web)
  let clerkUserId: string | null = null

  try {
    const authResult = await auth()
    clerkUserId = authResult.userId
  } catch (error) {
    // Clerk auth failed, try JWT token (mobile)
  }

  // If no Clerk auth, try mobile JWT token
  if (!clerkUserId) {
    const authHeader = request.headers.get('authorization')
    const token = extractTokenFromHeader(authHeader)

    if (token) {
      const payload = await verifyMobileToken(token)
      if (payload) {
        clerkUserId = payload.clerkUserId
      }
    }
  }

  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Continue with authenticated logic...
}
```

#### 3. Middleware Configuration: Register Mobile API Routes

**CRITICAL:** When you create a new API endpoint that needs mobile access, you MUST add it to the middleware's `isMobileApiRoute` matcher.

**Location:** `/apps/web/middleware.ts`

**How to fix:**
```typescript
// API routes that handle their own JWT authentication (for mobile)
const isMobileApiRoute = createRouteMatcher([
  '/api/jobs(.*)',
  '/api/clients(.*)',
  '/api/appointments(.*)',
  '/api/invoices(.*)',
  '/api/payments(.*)',
  '/api/quotes(.*)',
  '/api/expenses(.*)',
  '/api/users/me(.*)',
  '/api/organizations/current(.*)',
  '/api/organizations/members(.*)',
  '/api/docs(.*)',
  '/api/reminders(.*)', // ← ADD YOUR NEW ENDPOINT HERE
])
```

**What happens if you forget this:**
- Endpoint returns 404 instead of 401/200
- Clerk middleware blocks the request before it reaches your handler
- Mobile app gets "API Error: 404" even though the endpoint exists
- Web requests with Clerk auth might work, but mobile JWT auth fails

#### 4. API Response Format: Use snake_case

**WHY:** Database columns use snake_case, and mobile app expects snake_case from API responses.

**CORRECT:**
```typescript
return NextResponse.json({
  organization_id: orgId,
  invoice_reminders_enabled: true,
  reminder_days_before_due: '7,3,1',
  created_at: new Date().toISOString(),
})
```

**WRONG:**
```typescript
return NextResponse.json({
  organizationId: orgId,          // ❌ camelCase
  invoiceRemindersEnabled: true,  // ❌ camelCase
  reminderDaysBeforeDue: '7,3,1', // ❌ camelCase
  createdAt: new Date().toISOString(),
})
```

**Note:** The mobile app sends camelCase in request bodies but expects snake_case in responses.

### Troubleshooting Checklist: "Mobile App Getting 404 Errors"

When the mobile app reports 404 errors on an API endpoint, check in this order:

1. **Does the endpoint use Drizzle ORM?**
   - Search for `import { db }` or `import.*from '@tradie-app/database'`
   - If yes: Rewrite to use raw Neon SQL (`import { neon } from '@neondatabase/serverless'`)

2. **Is the endpoint in middleware.ts?**
   - Open `/apps/web/middleware.ts`
   - Check if your endpoint pattern is in `isMobileApiRoute` matcher
   - If not: Add it (e.g., `'/api/your-endpoint(.*)'`)

3. **Does the endpoint support JWT auth?**
   - Check for dual auth pattern (Clerk + JWT)
   - Must have `extractTokenFromHeader` and `verifyMobileToken` logic
   - Look at `/api/jobs/route.ts` or `/api/clients/route.ts` for reference

4. **Is the response in snake_case?**
   - Check all `NextResponse.json()` calls
   - Database results are already snake_case, don't transform them
   - Default/fallback objects must use snake_case

5. **Has the deployment completed?**
   - Build succeeds locally: `cd apps/web && npm run build`
   - Push to trigger Vercel deployment
   - Test endpoint: `curl -I https://tradie-app-web.vercel.app/api/your-endpoint`
   - Should return 401 (Unauthorized) without auth, NOT 404

### Reference: Working Example

See `/apps/web/app/api/reminders/settings/route.ts` for a complete example that follows all patterns:
- Uses raw Neon SQL (not Drizzle)
- Implements dual authentication
- Returns snake_case responses
- Registered in middleware.ts

### Common Error Messages and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Database connection string format for neon() should be: postgresql://...` | Drizzle ORM imported in API route | Replace with raw Neon SQL |
| `API Error: 404` from mobile app | Endpoint not in middleware.ts | Add to `isMobileApiRoute` matcher |
| `x-clerk-auth-status: signed-out` with 404 | Middleware blocking request | Add to `isMobileApiRoute` matcher |
| Mobile app can't read fields | Response using camelCase | Use snake_case in API responses |
| Build succeeds but 404 in production | Deployment not complete or cached | Wait for deployment, check Vercel logs |


Multi-Tenancy Architecture
Organization Structure
Organization (Business)
├── Owner (1) - Full control
├── Admins (0-n) - Nearly full control, no billing
├── Employees (0-n) - Limited permissions
└── Subcontractors (0-n) - View assigned jobs only
Data Isolation

All tables include organization_id foreign key
Row Level Security enforces data boundaries
Clerk Organizations manages membership
JWT tokens include organization context


Complete Database Schema
typescript// ==================== CORE MULTI-TENANCY ====================

organizations
- id (uuid, PK)
- name (business name)
- abn
- trade_type (plumber/electrician/builder/etc)
- logo_url
- phone, email
- address_line1, address_line2, city, state, postcode
- owner_id (FK → users)
- sms_credits (integer, default 0)
- sms_phone_number (organization's Tall Bob number)
- subscription_status (trial/active/cancelled/none) // future
- subscription_plan (free/pro) // future
- stripe_customer_id
- xero_connected (boolean)
- created_at, updated_at

users
- id (uuid, PK)
- clerk_user_id (unique, indexed)
- email, phone
- full_name
- profile_photo_url
- sms_phone_number (individual's Tall Bob number)
- created_at, updated_at

// ==================== TEAM MANAGEMENT ====================

organization_members
- id (uuid, PK)
- organization_id (FK → organizations)
- user_id (FK → users)
- role (owner/admin/employee/subcontractor)
- status (invited/active/suspended)
- invitation_token (nullable, unique)
- invitation_sent_at
- invitation_accepted_at
- hourly_rate (decimal, for labor costing)
- owed_amount (decimal, running total for subcontractors)
// Permissions
- can_create_jobs (boolean, default false)
- can_edit_all_jobs (boolean, default false)
- can_create_invoices (boolean, default false)
- can_view_financials (boolean, default false)
- can_approve_expenses (boolean, default false)
- can_approve_timesheets (boolean, default false)
- joined_at, created_at, updated_at

user_documents
- id (uuid, PK)
- user_id (FK → users)
- document_type (license/certification/insurance/white_card/etc)
- title
- document_number
- file_url
- issue_date
- expiry_date
- issuing_authority
- created_at, updated_at

// ==================== CLIENTS ====================

clients
- id (uuid, PK)
- organization_id (FK → organizations)
- xero_contact_id (nullable, for sync)
- client_type (residential/commercial)
- // Individual or Company
- is_company (boolean)
- company_name (nullable)
- first_name, last_name
- email, phone, mobile
- // Address
- site_address_line1, site_address_line2
- site_city, site_state, site_postcode
- billing_address_same_as_site (boolean)
- billing_address_line1, billing_address_line2
- billing_city, billing_state, billing_postcode
- // Business details
- abn (nullable)
- notes
- preferred_contact_method (email/sms/phone)
- created_by_user_id (FK → users)
- created_at, updated_at

client_contacts
- id (uuid, PK)
- client_id (FK → clients)
- name, role, email, phone
- is_primary (boolean)
- created_at

// ==================== JOBS ====================

jobs
- id (uuid, PK)
- organization_id (FK → organizations)
- job_number (auto-generated: JOB-2025-001)
- client_id (FK → clients)
- created_by_user_id (FK → users)
- assigned_to_user_id (FK → users, nullable)
- // Job details
- title
- description
- job_type (repair/installation/maintenance/inspection/quote/emergency)
- status (quoted/scheduled/in_progress/completed/invoiced/cancelled)
- priority (low/medium/high/urgent)
- // Location
- site_address_line1, site_address_line2
- site_city, site_state, site_postcode
- site_access_notes
- // Pricing
- quoted_amount (decimal, nullable)
- actual_amount (decimal, nullable)
- // Scheduling
- scheduled_date, scheduled_start_time, scheduled_end_time
- actual_start_time, actual_end_time
- completed_at
- // Related records
- quote_id (FK → quotes, nullable)
- invoice_id (FK → invoices, nullable)
- xero_quote_id (nullable)
- // Metadata
- created_at, updated_at

job_assignments
- id (uuid, PK)
- job_id (FK → jobs)
- user_id (FK → users)
- role (primary/assistant)
- assigned_at, removed_at

job_time_logs
- id (uuid, PK)
- job_id (FK → jobs)
- user_id (FK → users)
- log_type (manual/timer)
- start_time, end_time
- break_duration_minutes
- total_hours (calculated)
- hourly_rate (captured at time of log)
- labor_cost (calculated: hours × rate)
- notes
- status (pending/approved/rejected)
- approved_by_user_id (FK → users, nullable)
- approved_at
- created_at, updated_at

job_materials
- id (uuid, PK)
- job_id (FK → jobs)
- added_by_user_id (FK → users)
- material_type (product/part/hire_equipment)
- description
- supplier_name
- quantity
- unit_price
- total_cost (quantity × unit_price)
- receipt_url (nullable)
- status (pending/approved/rejected)
- approved_by_user_id (FK → users, nullable)
- approved_at
- allocated_to_user_id (FK → users, nullable) // for subcontractor tracking
- created_at, updated_at

job_photos
- id (uuid, PK)
- job_id (FK → jobs)
- uploaded_by_user_id (FK → users)
- photo_url
- thumbnail_url
- caption
- photo_type (before/during/after/issue/completion)
- uploaded_at

job_notes
- id (uuid, PK)
- job_id (FK → jobs)
- user_id (FK → users)
- note_text
- note_type (general/issue/client_request/internal)
- created_at

job_checklists
- id (uuid, PK)
- job_id (FK → jobs)
- checklist_template_id (FK → checklist_templates, nullable)
- title
- created_at

job_checklist_items
- id (uuid, PK)
- job_checklist_id (FK → job_checklists)
- item_text
- is_completed (boolean)
- completed_by_user_id (FK → users, nullable)
- completed_at
- item_order

// ==================== QUOTES ====================

quotes
- id (uuid, PK)
- organization_id (FK → organizations)
- quote_number (auto-generated: QTE-2025-001)
- client_id (FK → clients)
- created_by_user_id (FK → users)
- title
- description
- status (draft/sent/accepted/rejected/expired)
- subtotal, gst_amount, total_amount
- valid_until_date
- sent_at, accepted_at, rejected_at
- rejection_reason
- converted_to_job_id (FK → jobs, nullable)
- notes
- xero_quote_id (nullable)
- created_at, updated_at

quote_line_items
- id (uuid, PK)
- quote_id (FK → quotes)
- item_type (labor/material/equipment/other)
- description
- quantity
- unit_price
- gst_amount
- line_total
- line_order

// ==================== INVOICES ====================

invoices
- id (uuid, PK)
- organization_id (FK → organizations)
- invoice_number (auto-generated: INV-2025-001)
- job_id (FK → jobs, nullable)
- client_id (FK → clients)
- created_by_user_id (FK → users)
- status (draft/sent/paid/partially_paid/overdue/cancelled)
- subtotal, gst_amount, total_amount
- paid_amount
- issue_date, due_date, paid_date
- payment_terms (nullable, e.g., "Net 30")
- payment_method (cash/card/bank_transfer/stripe/other)
- notes
- footer_text
- // Xero sync
- xero_invoice_id (nullable)
- last_synced_at
- // Stripe (future online payments)
- stripe_invoice_id (nullable)
- stripe_payment_intent_id (nullable)
- created_at, updated_at

invoice_line_items
- id (uuid, PK)
- invoice_id (FK → invoices)
- source_type (job_time_log/job_material/manual)
- source_id (uuid, nullable) // references time log or material
- item_type (labor/material/equipment/fee/other)
- description
- quantity
- unit_price
- gst_amount
- line_total
- line_order

invoice_payments
- id (uuid, PK)
- invoice_id (FK → invoices)
- payment_date
- amount
- payment_method (cash/card/bank_transfer/stripe)
- reference_number
- notes
- recorded_by_user_id (FK → users)
- created_at

// ==================== EXPENSES ====================

expenses
- id (uuid, PK)
- organization_id (FK → organizations)
- user_id (FK → users) // who incurred it
- job_id (FK → jobs, nullable) // optional allocation
- category (fuel/materials/tools/vehicle/subcontractor/meals/other)
- description
- amount, gst_amount, total_amount
- receipt_url
- expense_date
- status (pending/approved/rejected/reimbursed)
- approved_by_user_id (FK → users, nullable)
- approved_at
- rejection_reason
- reimbursed_at
- // Xero sync
- xero_expense_id (nullable)
- last_synced_at
- created_at, updated_at

// ==================== SUBCONTRACTOR PAYMENTS ====================

subcontractor_payments
- id (uuid, PK)
- organization_id (FK → organizations)
- subcontractor_user_id (FK → users)
- payment_period_start, payment_period_end
- labor_amount (from approved time logs)
- materials_amount (from approved job materials)
- equipment_amount (from approved equipment hire)
- total_amount
- paid_amount
- status (pending/paid/partially_paid)
- paid_date
- payment_method (cash/bank_transfer/other)
- reference_number
- notes
- // Xero sync
- xero_bill_id (nullable)
- last_synced_at
- created_at, updated_at

subcontractor_payment_items
- id (uuid, PK)
- payment_id (FK → subcontractor_payments)
- item_type (time_log/material/equipment)
- source_id (uuid) // job_time_log_id or job_material_id
- description
- amount

// ==================== CALENDAR / SCHEDULING ====================

appointments
- id (uuid, PK)
- organization_id (FK → organizations)
- title, description
- appointment_type (job/quote/meeting/site_visit/admin/personal)
- start_time, end_time
- all_day (boolean)
- // Relations
- job_id (FK → jobs, nullable)
- client_id (FK → clients, nullable)
- assigned_to_user_id (FK → users)
- created_by_user_id (FK → users)
- // Location
- location_address
- // Reminders
- reminder_minutes_before
- reminder_sent_at
- // Recurrence (future feature)
- is_recurring (boolean)
- recurrence_rule (text, nullable)
- created_at, updated_at

// ==================== SMS SYSTEM ====================

sms_transactions
- id (uuid, PK)
- organization_id (FK → organizations)
- transaction_type (purchase/usage/adjustment/refund)
- credits_amount (integer) // positive = add, negative = deduct
- cost_amount (decimal) // in dollars
- balance_after (integer)
- description
- // For usage transactions
- recipient_phone (nullable)
- sender_user_id (FK → users, nullable)
- sms_type (invoice/quote/reminder/reply/notification)
- message_preview (text, first 50 chars)
- tallbob_message_id (nullable)
- delivery_status (pending/sent/delivered/failed)
- // Related records
- related_invoice_id (FK → invoices, nullable)
- related_quote_id (FK → quotes, nullable)
- related_job_id (FK → jobs, nullable)
- // For purchase transactions
- stripe_payment_intent_id (nullable)
- created_at

sms_conversations
- id (uuid, PK)
- organization_id (FK → organizations)
- phone_number (the client/recipient number)
- client_id (FK → clients, nullable)
- last_message_at
- created_at, updated_at

sms_messages
- id (uuid, PK)
- conversation_id (FK → sms_conversations)
- organization_id (FK → organizations)
- direction (outbound/inbound)
- sender_user_id (FK → users, nullable) // for outbound
- recipient_phone
- sender_phone
- message_body (text)
- character_count
- credits_used (for outbound)
- tallbob_message_id
- status (pending/sent/delivered/failed/received)
- // Context
- job_id (FK → jobs, nullable)
- invoice_id (FK → invoices, nullable)
- quote_id (FK → quotes, nullable)
- // Metadata
- sent_at, delivered_at, read_at
- created_at

tallbob_webhooks
- id (uuid, PK)
- webhook_type (delivery_status/inbound_message)
- tallbob_message_id
- payload (jsonb)
- processed (boolean)
- processed_at
- created_at

// ==================== INTEGRATIONS ====================

xero_connections
- id (uuid, PK)
- organization_id (FK → organizations) // one per org
- tenant_id (Xero tenant ID)
- access_token (encrypted)
- refresh_token (encrypted)
- expires_at
- connected_at
- last_sync_at
- // Sync preferences
- sync_contacts (boolean, default true)
- sync_invoices (boolean, default true)
- sync_expenses (boolean, default true)
- sync_bills (boolean, default true) // for subcontractor payments
- auto_sync_enabled (boolean, default true)

xero_sync_logs
- id (uuid, PK)
- organization_id (FK → organizations)
- sync_type (contacts/invoices/expenses/bills/full)
- entity_type (client/invoice/expense/bill)
- entity_id (uuid, nullable)
- action (create/update/delete)
- status (pending/success/error)
- xero_id (nullable)
- error_message (text, nullable)
- request_payload (jsonb, nullable)
- response_payload (jsonb, nullable)
- created_at

// ==================== ORGANIZATION SETTINGS ====================

organization_documents
- id (uuid, PK)
- organization_id (FK → organizations)
- document_type (insurance/license/abn/other)
- title
- document_number
- file_url
- issue_date, expiry_date
- uploaded_by_user_id (FK → users)
- created_at, updated_at

invoice_templates
- id (uuid, PK)
- organization_id (FK → organizations)
- template_name (default/custom1/custom2)
- is_default (boolean)
- // Branding
- logo_url
- primary_color
- // Content
- header_text
- footer_text
- payment_terms
- show_abn (boolean)
- show_business_address (boolean)
- created_at, updated_at

email_templates
- id (uuid, PK)
- organization_id (FK → organizations)
- template_type (invoice/quote/reminder/welcome)
- subject
- body_template (text with variables)
- is_default (boolean)
- created_at, updated_at

sms_templates
- id (uuid, PK)
- organization_id (FK → organizations)
- template_type (invoice/quote/reminder/job_update)
- message_template (text with variables)
- is_default (boolean)
- created_at, updated_at

// ==================== FUTURE FEATURES ====================

subscriptions
- id (uuid, PK)
- organization_id (FK → organizations)
- plan_type (free/pro)
- status (trialing/active/cancelled/past_due)
- stripe_subscription_id
- current_period_start, current_period_end
- cancel_at_period_end (boolean)
- created_at, updated_at

notification_preferences
- id (uuid, PK)
- user_id (FK → users)
- // Push notifications
- job_assigned (boolean)
- job_updated (boolean)
- invoice_paid (boolean)
- expense_approved (boolean)
- timesheet_approved (boolean)
- low_sms_credits (boolean)
- // Email notifications
- email_job_assigned (boolean)
- email_invoice_paid (boolean)
- email_weekly_summary (boolean)
- created_at, updated_at

audit_logs
- id (uuid, PK)
- organization_id (FK → organizations)
- user_id (FK → users, nullable)
- action_type (create/update/delete/login)
- entity_type (job/invoice/client/etc)
- entity_id (uuid, nullable)
- changes (jsonb)
- ip_address
- user_agent
- created_at

Role-Based Permissions Matrix
FeatureOwnerAdminEmployeeSubcontractorOrganizationEdit org details✅✅❌❌View billing/SMS usage✅✅❌❌Buy SMS credits✅✅❌❌Manage Xero integration✅✅❌❌TeamInvite members✅✅❌❌Edit member permissions✅✅❌❌Remove members✅✅❌❌View all team members✅✅✅❌ClientsCreate/edit clients✅✅✅*❌View all clients✅✅✅❌Delete clients✅✅❌❌JobsCreate jobs✅✅✅*❌View all jobs✅✅✅❌View assigned jobs✅✅✅✅Assign jobs✅✅❌❌Edit any job✅✅❌❌Delete jobs✅✅❌❌Time TrackingLog time to assigned jobs✅✅✅✅Approve timesheets✅✅❌❌View all time logs✅✅❌❌Materials/EquipmentAdd materials to jobs✅✅✅✅Approve materials✅✅❌❌View all materials✅✅❌❌InvoicesCreate invoices✅✅✅*❌View all invoices✅✅✅*❌Send invoices✅✅✅*❌Record payments✅✅✅*❌Delete invoices✅✅❌❌QuotesCreate quotes✅✅✅*❌View all quotes✅✅✅*❌Send quotes✅✅✅*❌ExpensesSubmit expenses✅✅✅✅Approve expenses✅✅❌❌View all expenses✅✅❌❌View own expenses✅✅✅✅ReportsView financial reports✅✅❌❌View team performance✅✅❌❌View own performance✅✅✅✅Subcontractor PaymentsView payment schedule✅✅❌❌View own payments---✅Process payments✅✅❌❌SMSSend SMS (uses org credits)✅✅✅*❌View SMS conversations✅✅✅*❌Reply to SMS✅✅✅*❌
*Can be toggled per employee

SMS System Specifications
Pricing Structure
Cost: 5¢ per SMS (per 160 characters)
Credit Bundles:

100 SMS = $5.00 (5¢ each)
500 SMS = $25.00 (5¢ each)
1,000 SMS = $50.00 (5¢ each)
5,000 SMS = $250.00 (5¢ each)

Character Counting:

Standard SMS: 160 characters = 1 credit
161-320 characters = 2 credits
321-480 characters = 3 credits
And so on...

Two-Way SMS Architecture
Outbound SMS (App → Client):

User composes message in app
Choose sender:

Organization SMS number (default)
User's personal SMS number (if configured)


System checks SMS credits
Sends via Tall Bob API
Deducts credits
Creates conversation thread
Logs message in sms_messages

Inbound SMS (Client → App):

Client replies to SMS
Tall Bob webhook receives inbound message
System identifies conversation by phone number
Links to client record if exists
Notifies relevant user(s) via push notification
Message appears in conversation thread in app
User can reply directly from app

Conversation Threading:

Each unique phone number = one conversation
Messages displayed chronologically
Context preserved (which job/invoice triggered conversation)
Multiple users can view conversation
Only sender or org owner/admin can reply

Tall Bob Integration Points:
typescript// Send SMS from user's number
POST /api/sms/send
{
  from: user.sms_phone_number,
  to: client.phone,
  message: "Invoice #1234 sent...",
  context: {
    jobId: "uuid",
    invoiceId: "uuid"
  }
}

// Webhook for inbound messages
POST /api/webhooks/tallbob/inbound
{
  messageId: "tb_msg_123",
  from: "+61412345678",
  to: "+61487654321", // org or user number
  body: "Thanks, received!",
  receivedAt: "2025-01-15T10:30:00Z"
}

// Webhook for delivery status
POST /api/webhooks/tallbob/status
{
  messageId: "tb_msg_123",
  status: "delivered",
  deliveredAt: "2025-01-15T10:29:45Z"
}
```

### SMS Features

**Automated SMS:**
- Invoice sent notification
- Quote sent notification
- Payment reminder (1 day before due)
- Job reminder (1 day before scheduled)
- Job assignment notification
- Custom scheduled messages

**Manual SMS:**
- Quick message to client
- Reply to inbound message
- Bulk SMS to multiple clients (future)

**SMS Templates (Customizable):**
```
Invoice: "Hi {client_name}, your invoice #{invoice_number} for ${total} is ready. Pay here: {link}. - {business_name}"

Quote: "Hi {client_name}, your quote #{quote_number} for {job_title} is ready to view: {link}. Valid until {expiry_date}. - {business_name}"

Reminder: "Hi {client_name}, friendly reminder that invoice #{invoice_number} for ${total} is due on {due_date}. - {business_name}"

Job Update: "Hi {client_name}, we're on our way to {address}. ETA: {time}. - {name} from {business_name}"
```

**Credit Management:**
- Display current balance prominently
- Warning at 20 credits remaining
- Low balance email notification
- Purchase flow integrated in app
- Auto-suggest bundle based on usage
- Transaction history with export

---

## Branding & Customization

### Organization Branding

**Logo:**
- Upload in settings
- Used in: invoices (PDF), email headers, app header (optional)
- Formats: PNG, JPG (transparent PNG recommended)
- Max size: 2MB
- Recommended: 500×200px

**Email Customization:**
- Company name in "From" field: "{Business Name} <noreply@app.com>"
- Logo in header
- Primary color for buttons
- Custom footer text
- Custom email signature

**SMS Customization:**
- Company name automatically appended
- Send from: Organization SMS number or individual user numbers
- Templates fully customizable
- Variable insertion: {business_name}, {client_name}, {amount}, etc.

**Invoice Branding:**
- Company logo (top left)
- Business name, ABN, address
- Custom color scheme (primary color)
- Custom header text (e.g., "Tax Invoice")
- Custom footer (e.g., payment terms, thank you message)
- Custom payment instructions

---

## Subcontractor Payment Tracking

### Tracking Components

**Labor (Time-based):**
- Subcontractor logs hours on assigned jobs
- Hourly rate captured from `organization_members.hourly_rate`
- Time logs require approval (Owner/Admin)
- Calculation: `hours × hourly_rate = labor_cost`
- Accumulates in `organization_members.owed_amount`

**Materials/Products:**
- Subcontractor adds materials used on job
- Captures: description, supplier, quantity, unit price
- Uploads receipt photo
- Requires approval (Owner/Admin)
- Can be marked as "purchased by subcontractor" → add to owed amount
- Or "purchased by company" → track as company expense

**Equipment Hire:**
- Subcontractor adds hired equipment to job
- Daily/weekly/monthly rate
- Start date, end date, total cost
- Receipt upload
- Requires approval
- Adds to owed amount if paid by subcontractor

### Payment Workflow

**Creating Payment Record:**
1. Owner/Admin navigates to subcontractor profile
2. Views "Amount Owed" (running total)
3. Clicks "Create Payment"
4. System auto-populates:
   - All approved, unpaid time logs
   - All approved, unpaid materials
   - All approved, unpaid equipment
5. Review and confirm breakdown
6. Record payment:
   - Payment date
   - Amount paid
   - Payment method (bank transfer, cash, check)
   - Reference number
7. Option to sync to Xero as Bill
8. Payment recorded → `owed_amount` updated

**Subcontractor View:**
- Dashboard shows: "Amount Owed to Me: $2,450"
- View breakdown:
  - Pending approval: $800 (awaiting approval)
  - Approved, unpaid: $1,250
  - Paid this month: $3,100
- Payment history
- Download payment statements

**Xero Sync:**
- Create Bill in Xero when payment processed
- Sync subcontractor as Supplier in Xero
- Line items: labor, materials, equipment
- Mark as paid in Xero when recorded in app

---

## Xero Integration Scope

### Four-Way Sync

**1. Contacts (Clients) ↔ Xero**
- **App → Xero:** Create/update clients as Contacts
- **Xero → App:** Import existing contacts (one-time or periodic)
- Mapping: client name, email, phone, address, ABN
- Conflict resolution: App is source of truth, Xero updated

**2. Invoices ↔ Xero**
- **App → Xero:** Create/update invoices automatically
- When invoice status = "sent" or "paid"
- Line items, GST, amounts, due dates all synced
- **Xero → App:** Payment status synced back
- If paid in Xero, mark as paid in app
- Two-way payment reconciliation

**3. Expenses ↔ Xero**
- **App → Xero:** Sync approved expenses as Bank Transactions or Expenses
- Categories mapped to Xero accounts
- Receipt images attached (if Xero API supports)
- **Xero → App:** (Optional) Import Xero expenses not in app

**4. Bills (Subcontractor Payments) → Xero**
- **App → Xero:** Create Bill when subcontractor paid
- Subcontractor = Supplier in Xero
- Line items detail labor + materials + equipment
- Mark as paid with payment date
- **Xero → App:** Read-only, no import needed

### OAuth Flow
1. User clicks "Connect Xero" in settings
2. Redirects to Xero OAuth consent
3. User selects Xero organization
4. Callback receives tokens
5. Store encrypted in `xero_connections`
6. Initial sync prompt: "Import existing contacts?"

### Sync Options
- **Auto-sync:** Real-time (on invoice send, payment record, etc.)
- **Manual sync:** "Sync Now" button
- **Scheduled sync:** Nightly for payment status updates
- **Conflict handling:** Log conflicts, manual resolution

### Sync Logs & Debugging
- Every sync action logged
- Success/failure status
- Error messages preserved
- Retry mechanism for failed syncs
- User-friendly error messages

---

## Approval Workflows

### Timesheet Approval

**Submission:**
- Employee/subcontractor logs time on job
- Status = "pending"
- Owner/Admin sees badge notification

**Approval:**
- Owner/Admin reviews time log
- Can edit (with reason)
- Approve or reject
- If approved → status = "approved"
- If approved → add to owed amount (subcontractor)
- If approved → can be invoiced to client

**Bulk Approval:**
- Weekly timesheet view
- Select all
- Approve all at once

### Expense Approval

**Submission:**
- Team member adds expense
- Uploads receipt (required)
- Status = "pending"
- Notification to approvers

**Approval:**
- Owner/Admin reviews
- Verify receipt
- Check amounts, GST
- Approve or reject with reason
- If approved → sync to Xero
- If approved → add to reimbursement queue

**Reimbursement Tracking:**
- Approved expenses show "Awaiting Reimbursement"
- Mark as reimbursed with payment date
- Track total owed per team member

### Material/Equipment Approval

**Submission:**
- Added to job by team member
- Includes receipt
- Status = "pending"

**Approval:**
- Owner/Admin reviews
- Confirms receipt matches amount
- Approve → allocated to job
- If purchased by subcontractor → add to owed amount
- Can be included in client invoice

---

## Core Features (MVP)

### 1. Authentication & Multi-Tenant Onboarding

**Owner Registration:**
- Sign up with email/password
- Email verification
- Create organization:
  - Business name, ABN, trade type
  - Contact details
  - Business address
  - Upload logo
- Set up SMS number (Tall Bob provisioning)
- Upload company documents
- Choose plan (free for now)
- Welcome tour

**Team Member Invitation:**
- Owner/Admin clicks "Invite Team Member"
- Enter: name, email, role (Employee/Subcontractor)
- Set hourly rate (if applicable)
- Set permissions
- Send invitation (email + optional SMS)
- Invitation expires in 7 days

**Member Acceptance:**
- Receives invitation email/SMS
- Clicks link (with token)
- Sign up or log in
- Completes profile:
  - Full name, phone
  - Profile photo
  - SMS number (optional, for sending from personal number)
  - Upload licenses/certifications
  - Emergency contact (optional)
- Automatically joins organization
- Sees dashboard based on role

### 2. Team Management Dashboard

**Team List (Owner/Admin):**
- Grid/list view
- Filter: All/Active/Invited/Suspended
- Search by name
- Sort by: name, role, join date
- Quick actions per member

**Member Detail View:**
- Profile info
- Role & permissions
- Documents/licenses
- Jobs assigned (count + list)
- Hours worked (total, this week, this month)
- Amount owed (for subcontractors)
- Performance metrics
- Edit/suspend/remove buttons

**Permissions Management:**
- Granular toggles per employee
- Preset roles (can customize)
- Changes take effect immediately

### 3. Client Management (CRM)

**Client List:**
- Search and filter
- Quick actions: call, SMS, email, add job
- Shows: last job date, total jobs, outstanding invoices

**Client Detail:**
- Contact information
- Site address(es)
- Job history
- Quote history
- Invoice history (outstanding, paid)
- Total revenue from client
- Notes timeline
- Quick actions

**Client Creation:**
- Simple form
- Optional company vs. individual
- Multiple site addresses
- Preferred contact method
- Auto-suggest from Xero (if connected)

### 4. Job Management (Team-Centric)

**Job Creation:**
- Select client (or create new)
- Job title & description
- Job type (dropdown)
- Priority
- Site address (auto-fill from client or custom)
- Assign to team member(s)
- Scheduled date/time
- Add initial photos
- Quoted amount (optional)
- Save as draft or scheduled

**Job Detail View:**
- Header: job number, status badge, priority
- Client info (tap to view client)
- Assigned team members (avatars)
- Scheduled date/time
- Description & site access notes
- Tabs:
  - **Overview:** details, timeline
  - **Time:** time logs (with approval status)
  - **Materials:** materials/equipment used
  - **Photos:** before/during/after gallery
  - **Notes:** chronological notes
  - **Checklist:** custom checklists
  - **Invoice:** linked invoice (if exists)

**Job Assignment:**
- Assign to one or multiple team members
- Primary vs. assistant role
- Notification sent immediately
- Shows in assignee's calendar
- Reassign at any time

**Job Status Workflow:**
```
Draft → Quoted → Scheduled → In Progress → Completed → Invoiced
         ↓
      Cancelled
```

**Time Tracking:**
- Start/stop timer (live timer UI)
- Manual entry
- Add break duration
- Notes field
- Auto-calculate hours
- Status badge: Pending/Approved/Rejected
- Approve button (Owner/Admin)

**Materials & Equipment:**
- Add item button
- Type: Product / Part / Hire Equipment
- Fields: description, supplier, qty, unit price, total
- Upload receipt
- Allocate to subcontractor (checkbox)
- Status: Pending/Approved/Rejected
- Approve button (Owner/Admin)

**Job Photos:**
- Take photo or upload
- Categorize: Before/During/After/Issue/Completion
- Add caption
- Gallery view
- Full-screen viewer
- Share photos with client (future)

**Job Completion:**
- Mark complete button
- Reviews all time logs (warns if unapproved)
- Reviews all materials
- Asks: "Create invoice now?"
- Updates job status

### 5. Calendar & Scheduling

**Views:**
- Day view (timeline with hours)
- Week view (7 columns)
- Month view (calendar grid)
- Agenda list view

**Team Calendar:**
- Multi-select team members
- Color-coded by person
- Toggle visibility per person
- Filter by appointment type

**Creating Appointments:**
- Drag to create on calendar
- Or "Add Appointment" button
- Link to job (optional)
- Link to client (optional)
- Assign to team member
- Set reminder
- Recurring appointments (future)

**Drag & Drop:**
- Reschedule by dragging
- Reassign by dragging to different person
- Conflict warnings

**Notifications:**
- Push notification for assigned appointments
- SMS reminder option (costs credits)
- Email reminder option

### 6. Invoicing System

**Creating Invoice:**
- From completed job (auto-populate)
- Or manual/standalone
- Auto-generates invoice number
- Pre-fills from job:
  - Client details
  - Line items from time logs (approved only)
  - Line items from materials (approved only)
  - Labor: "{User name} - {hours} hours @ ${rate}/hr"
  - Materials: "{Description} - qty {qty} @ ${price}"
- Manual line items:
  - Description, qty, unit price
  - Auto-calculate GST
- Add footer notes
- Preview PDF

**Sending Invoice:**
- Email (free): shows preview, sends PDF
- SMS (costs credits): "Invoice sent" message with link
- Email + SMS option
- Mark as "Sent"
- Logged in activity

**Invoice Templates:**
- Default template with org logo
- Customizable:
  - Colors
  - Header text
  - Footer text
  - Payment terms
- Multiple templates (future)

**Payment Recording:**
- "Record Payment" button
- Amount (can be partial)
- Payment date
- Payment method
- Reference number
- Automatically updates status (Paid / Partially Paid)
- Syncs to Xero

**Xero Sync:**
- Auto-sync on invoice send
- Sync payment status back from Xero
- Handle conflicts gracefully
- Manual sync button

### 7. Quotes/Estimates

**Creating Quote:**
- Similar to invoice
- Quote number auto-generated
- Set valid until date
- Status: Draft / Sent / Accepted / Rejected / Expired
- Can include photos, descriptions
- PDF generation

**Sending Quote:**
- Email + SMS options
- Client can view online (future: accept/reject button)
- Expires automatically

**Converting to Job:**
- "Accept Quote" button
- Auto-creates job from quote
- Pre-fills job details
- Links quote to job

**Xero Sync:**
- Sync to Xero as Quote (if supported)
- Or skip Xero for quotes

### 8. Expense Management

**Adding Expense:**
- Amount & GST
- Category (dropdown)
- Description
- Upload receipt (required)
- Date
- Allocate to job (optional)
- Submit for approval

**Approval Queue (Owner/Admin):**
- List of pending expenses
- Grid view with thumbnails
- Tap to review
- View receipt full-screen
- Approve/Reject with reason
- Bulk approve

**Expense Categories:**
- Fuel
- Materials
- Tools
- Vehicle maintenance
- Subcontractor costs
- Meals
- Other
- Custom categories

**Reimbursement:**
- Approved expenses show "Awaiting Reimbursement"
- "Mark as Reimbursed" button
- Track reimbursement by team member
- Export reimbursement report

**Xero Sync:**
- Approved expenses sync to Xero
- Map categories to Xero accounts
- Attach receipt image (if supported)

### 9. Subcontractor Payments

**Dashboard Widget (Subcontractor View):**
- "Amount Owed to Me: $X,XXX"
- Breakdown:
  - Pending approval: $XXX
  - Approved, unpaid: $XXX
- "View Details" button

**Payment Details (Subcontractor):**
- Time logs (pending, approved, paid)
- Materials (pending, approved, paid)
- Equipment (pending, approved, paid)
- Payment history
- Download statement

**Processing Payment (Owner/Admin):**
- Navigate to subcontractor profile
- "Create Payment" button
- Auto-populates unpaid items
- Review breakdown
- Enter payment details:
  - Date paid
  - Amount
  - Method
  - Reference number
- "Record Payment" button
- Updates owed amount
- Syncs to Xero as Bill
- Notification sent to subcontractor

### 10. SMS Conversations (Two-Way)

**SMS Inbox:**
- List of conversations (phone numbers)
- Shows: client name (if linked), last message, unread badge
- Search conversations
- Filter: unread, by date, by client

**Conversation Thread:**
- Chat interface
- Inbound messages (left, grey)
- Outbound messages (right, blue)
- Timestamps
- Delivery status icons
- Context badges (e.g., "Invoice #1234", "Job #567")
- Load more (pagination)

**Sending SMS:**
- Text input at bottom
- Character counter (shows credit cost)
- Send button
- Option to send from: Org number or My number
- Deducts credits on send
- Shows in conversation

**Context Integration:**
- Send invoice SMS → creates conversation with context
- Client replies → notification with context
- Open conversation from job/invoice detail

**Notifications:**
- Push notification for inbound SMS
- Badge count on SMS tab
- Shows sender name and preview

### 11. SMS Credit Management

**Dashboard Widget:**
- "SMS Credits: XXX"
- Color-coded:
  - Green: >100 credits
  - Yellow: 20-100 credits
  - Red: <20 credits
- "Buy Credits" button

**Purchase Flow:**
- Choose bundle:
  - 100 SMS ($5)
  - 500 SMS ($25)
  - 1,000 SMS ($50)
  - 5,000 SMS ($250)
- Redirect to Stripe Checkout
- Payment confirmation
- Credits added instantly
- Receipt emailed

**Transaction History:**
- Filter: Purchases / Usage / All
- Shows: date, type, credits, balance after
- For usage: shows recipient, message preview
- Export to CSV

**Usage Analytics:**
- SMS sent this week/month
- Cost this week/month
- Average cost per job
- Most common SMS types

### 12. Reporting & Dashboard

**Owner/Admin Dashboard:**
- Today's jobs (by team member, status)
- This week's schedule (calendar widget)
- Outstanding invoices (count, total $)
- SMS credits remaining
- Recent activity feed
- Quick stats:
  - Revenue this month
  - Jobs completed this week
  - Hours logged this week
  - Pending approvals (timesheets, expenses)

**Employee Dashboard:**
- My jobs today
- My upcoming schedule
- My hours this week (with approval status)
- Recent activity
- Pending items (timesheets to submit)

**Subcontractor Dashboard:**
- Assigned jobs (upcoming, in progress)
- Hours logged this week
- Amount owed to me
- Recent payments
- Pending approvals

**Reports (Owner/Admin):**
- **Revenue Report:**
  - By period (week/month/quarter/year)
  - By client
  - By job type
  - Chart + export
- **Time Tracking Report:**
  - Hours by team member
  - Hours by job
  - Billable vs. non-billable
  - Labor costs
- **Expense Report:**
  - By category
  - By team member
  - By job
  - Reimbursement summary
- **Team Performance:**
  - Jobs completed per person
  - Revenue generated per person
  - Average job duration
  - Client satisfaction (future)
- **SMS Usage Report:**
  - Usage over time
  - Cost analysis
  - Delivery success rate

### 13. Xero Integration

**Settings Page:**
- "Connect Xero" button (if not connected)
- Shows status: "Connected to: [Xero Org Name]"
- Last sync: timestamp
- Sync preferences:
  - ☑ Auto-sync invoices
  - ☑ Auto-sync expenses
  - ☑ Auto-sync contacts
  - ☑ Sync subcontractor bills
- "Sync Now" button
- "View Sync Log"
- "Disconnect" button

**Sync Log:**
- List of sync events
- Filter by: type, status, date
- Shows: timestamp, entity, action, status
- Error messages (if failed)
- "Retry" button for failed syncs

**OAuth Flow:**
- Secure redirect to Xero
- User authorizes app
- Callback receives tokens
- Store encrypted
- Initial sync prompt

**Initial Import (Optional):**
- "Import existing contacts from Xero?"
- Shows count
- Preview list
- Confirm import
- Progress indicator

### 14. Settings & Customization

**Organization Settings:**
- Business details (name, ABN, trade type)
- Contact details (phone, email, address)
- Upload/change logo
- SMS number (view/change)
- Time zone
- Default tax rate (GST)

**Branding:**
- Logo upload/crop
- Primary brand color
- Invoice template customization:
  - Header text
  - Footer text
  - Payment terms
  - Show/hide ABN, address

**Email Templates:**
- Invoice email template
- Quote email template
- Reminder email template
- Variables: {client_name}, {invoice_number}, {amount}, {link}

**SMS Templates:**
- Invoice SMS template
- Quote SMS template
- Job reminder template
- Custom templates
- Character counter

**Documents:**
- Upload company insurance
- Upload business license
- Upload ABN certificate
- Set expiry dates
- Expiry reminders

**Integrations:**
- Xero (connect/disconnect)
- Stripe (connected automatically for SMS purchases)
- Future: MYOB, QuickBooks, etc.

**Team Permissions Presets:**
- Define custom roles
- Set default permissions for new employees
- Templates for common roles

**Notifications:**
- Push notification preferences (per user)
- Email notification preferences (per user)
- SMS notification preferences (org level)

### 15. User Profile (Individual)

**My Profile:**
- Full name, email, phone
- Profile photo
- SMS phone number
- Change password
- Two-factor authentication (future)

**My Documents:**
- Upload licenses (trade, driver's, etc.)
- Certifications
- Insurance documents
- Set expiry dates
- Receive expiry alerts

**My Performance (Employee/Subcontractor):**
- Jobs completed
- Hours worked
- Revenue generated (Employee only)
- Amount earned (Subcontractor only)

**Notification Settings:**
- Push notifications per category
- Email digests
- SMS alerts

---

## API Endpoints (Complete)
```
POST   /api/auth/signup-owner
POST   /api/auth/signup-member
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/verify-invitation/:token

GET    /api/organizations/current
PUT    /api/organizations/current
POST   /api/organizations/logo-upload
GET    /api/organizations/members
POST   /api/organizations/members/invite
PUT    /api/organizations/members/:id
DELETE /api/organizations/members/:id
POST   /api/organizations/members/:id/resend-invitation
PUT    /api/organizations/members/:id/suspend

GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id
GET    /api/clients/:id/jobs
GET    /api/clients/:id/invoices

GET    /api/jobs
POST   /api/jobs
GET    /api/jobs/assigned-to-me
GET    /api/jobs/:id
PUT    /api/jobs/:id
DELETE /api/jobs/:id
POST   /api/jobs/:id/assign
POST   /api/jobs/:id/start-timer
POST   /api/jobs/:id/stop-timer
POST   /api/jobs/:id/complete
GET    /api/jobs/:id/time-logs
POST   /api/jobs/:id/time-logs
PUT    /api/jobs/:id/time-logs/:logId
DELETE /api/jobs/:id/time-logs/:logId
POST   /api/jobs/:id/time-logs/:logId/approve
POST   /api/jobs/:id/time-logs/:logId/reject
GET    /api/jobs/:id/materials
POST   /api/jobs/:id/materials
PUT    /api/jobs/:id/materials/:materialId
DELETE /api/jobs/:id/materials/:materialId
POST   /api/jobs/:id/materials/:materialId/approve
POST   /api/jobs/:id/materials/:materialId/reject
GET    /api/jobs/:id/photos
POST   /api/jobs/:id/photos
DELETE /api/jobs/:id/photos/:photoId
GET    /api/jobs/:id/notes
POST   /api/jobs/:id/notes
DELETE /api/jobs/:id/notes/:noteId

GET    /api/calendar/appointments
POST   /api/calendar/appointments
GET    /api/calendar/appointments/:id
PUT    /api/calendar/appointments/:id
DELETE /api/calendar/appointments/:id
GET    /api/calendar/team-availability

GET    /api/quotes
POST   /api/quotes
GET    /api/quotes/:id
PUT    /api/quotes/:id
DELETE /api/quotes/:id
POST   /api/quotes/:id/send-email
POST   /api/quotes/:id/send-sms
POST   /api/quotes/:id/accept
POST   /api/quotes/:id/reject
POST   /api/quotes/:id/convert-to-job

GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/outstanding
GET    /api/invoices/:id
PUT    /api/invoices/:id
DELETE /api/invoices/:id
GET    /api/invoices/:id/pdf
POST   /api/invoices/:id/send-email
POST   /api/invoices/:id/send-sms
POST   /api/invoices/:id/payments
PUT    /api/invoices/:id/payments/:paymentId

GET    /api/expenses
POST   /api/expenses
GET    /api/expenses/pending-approval
GET    /api/expenses/:id
PUT    /api/expenses/:id
DELETE /api/expenses/:id
POST   /api/expenses/:id/approve
POST   /api/expenses/:id/reject
POST   /api/expenses/:id/mark-reimbursed

GET    /api/subcontractors/:id/summary
POST   /api/subcontractors/:id/create-payment
GET    /api/subcontractors/:id/payments
GET    /api/subcontractors/:id/statement

GET    /api/sms/balance
GET    /api/sms/transactions
POST   /api/sms/purchase-credits
POST   /api/sms/send
GET    /api/sms/conversations
GET    /api/sms/conversations/:id/messages
POST   /api/sms/conversations/:id/messages
POST   /api/webhooks/tallbob/inbound
POST   /api/webhooks/tallbob/status

GET    /api/xero/status
GET    /api/xero/connect
GET    /api/xero/callback
POST   /api/xero/disconnect
POST   /api/xero/sync-contacts
POST   /api/xero/sync-invoices
POST   /api/xero/sync-expenses
POST   /api/xero/sync-bills
POST   /api/xero/sync-all
GET    /api/xero/sync-log

POST   /api/stripe/create-payment-intent
POST   /api/webhooks/stripe

GET    /api/reports/revenue
GET    /api/reports/time-tracking
GET    /api/reports/expenses
GET    /api/reports/team-performance
GET    /api/reports/sms-usage

GET    /api/documents/organization
POST   /api/documents/organization
DELETE /api/documents/organization/:id
GET    /api/documents/user
POST   /api/documents/user
DELETE /api/documents/user/:id

GET    /api/templates/invoice
PUT    /api/templates/invoice/:id
GET    /api/templates/email
PUT    /api/templates/email/:id
GET    /api/templates/sms
PUT    /api/templates/sms/:id

GET    /api/user/profile
PUT    /api/user/profile
POST   /api/user/profile/photo
PUT    /api/user/preferences

GET    /api/settings/organization
PUT    /api/settings/organization
GET    /api/settings/branding
PUT    /api/settings/branding
```

---

## Development Phases (16 Weeks)

### Phase 1: Foundation (Weeks 1-2)
**Deliverables:**
- Monorepo setup (apps/mobile, apps/web, packages/database)
- Database schema + migrations
- Clerk authentication with Organizations
- Basic API structure
- Owner signup + organization creation
- Deploy to Vercel

**Tasks:**
- Initialize Expo project
- Initialize Next.js project
- Set up Neon database
- Configure Drizzle ORM
- Implement Clerk integration
- Create organization onboarding flow
- Basic dashboard shell

### Phase 2: Team Management (Weeks 3-4)
**Deliverables:**
- Invitation system (email + SMS)
- Member signup flow
- Role-based permissions
- Team member CRUD
- Document upload for users

**Tasks:**
- Build invitation API
- Create invitation email templates
- Implement member acceptance flow
- Build team management UI
- Document upload to Vercel Blob
- Permission middleware

### Phase 3: Core Job Management (Weeks 5-7)
**Deliverables:**
- Job CRUD with assignment
- Client management
- Time tracking (start/stop/manual)
- Material/equipment tracking
- Job photos
- Approval workflows (time + materials)

**Tasks:**
- Job creation/editing UI
- Client database UI
- Timer functionality
- Material entry forms
- Photo upload/gallery
- Approval queue UI
- Job status workflow

### Phase 4: Calendar & Scheduling (Week 8)
**Deliverables:**
- Calendar views (day/week/month)
- Team calendar
- Appointment CRUD
- Drag-and-drop assignment
- Reminders

**Tasks:**
- Integrate calendar library
- Build multi-user view
- Implement drag-and-drop
- Create appointment forms
- Set up push notifications

### Phase 5: Invoicing (Weeks 9-10)
**Deliverables:**
- Invoice creation from jobs
- Invoice PDF generation
- Email sending
- Payment recording
- Invoice templates with branding

**Tasks:**
- Build invoice generation logic
- Implement PDF generation (puppeteer or similar)
- Email service integration
- Payment tracking
- Template customization UI

### Phase 6: Quotes System (Week 11)
**Deliverables:**
- Quote CRUD
- Quote sending (email/SMS)
- Quote acceptance/rejection
- Convert quote to job

**Tasks:**
- Quote forms
- PDF generation for quotes
- Acceptance workflow
- Job conversion logic

### Phase 7: SMS Integration (Weeks 12-13)
**Deliverables:**
- Tall Bob API integration
- Two-way SMS functionality
- SMS conversations UI
- SMS credit purchase via Stripe
- Transaction logging
- SMS templates

**Tasks:**
- Implement Tall Bob API wrapper
- Build conversation threading
- Create chat UI
- Webhook handlers (inbound, delivery status)
- Stripe checkout integration
- Credit management system
- Template editor

### Phase 8: Xero Integration (Weeks 14-15)
**Deliverables:**
- Xero OAuth flow
- Sync contacts, invoices, expenses, bills
- Sync log and error handling
- Manual and auto-sync

**Tasks:**
- Implement Xero OAuth
- Token management and refresh
- Create sync functions for each entity
- Conflict resolution logic
- Sync log UI
- Settings page for Xero

### Phase 9: Expense & Subcontractor Payments (Week 16)
**Deliverables:**
- Expense submission and approval
- Reimbursement tracking
- Subcontractor payment processing
- Payment history and statements

**Tasks:**
- Expense forms
- Approval workflow
- Subcontractor summary calculations
- Payment recording
- Bill sync to Xero
- Statement generation

### Phase 10: Reports & Analytics (Week 17)
**Deliverables:**
- Revenue reports
- Time tracking reports
- Expense reports
- Team performance reports
- SMS usage reports
- Export functionality

**Tasks:**
- Build report queries
- Create chart components
- Implement date range filters
- CSV export
- PDF export (optional)

### Phase 11: Settings & Customization (Week 18)
**Deliverables:**
- Organization settings
- Branding customization
- Email/SMS template editor
- Document management
- User preferences

**Tasks:**
- Settings UI
- Logo upload/cropping
- Template editor with variables
- Document expiry reminders
- Notification preferences

### Phase 12: Polish & Testing (Weeks 19-20)
**Deliverables:**
- Bug fixes
- Performance optimization
- UI/UX refinements
- Comprehensive testing
- Documentation

**Tasks:**
- Fix bugs from all phases
- Optimize slow queries
- Improve loading states
- Test all permission levels
- Test Xero sync edge cases
- Test SMS delivery
- Onboarding improvements
- Create user guide

### Phase 13: Beta Testing (Weeks 21-22)
**Deliverables:**
- Beta release to 5-10 real trade businesses
- Feedback collection
- Critical bug fixes
- Feature adjustments

**Tasks:**
- Recruit beta testers
- Onboard beta users
- Monitor usage
- Collect feedback
- Fix critical issues
- Iterate on UX

### Phase 14: Launch Preparation (Week 23)
**Deliverables:**
- App Store submission (iOS)
- Google Play submission (Android)
- Landing page
- Marketing materials
- Support documentation

**Tasks:**
- Prepare app store assets
- Write app descriptions
- Create screenshots
- Submit for review
- Build landing page
- Create help docs

### Phase 15: Launch & Monitor (Week 24)
**Deliverables:**
- Public launch
- Monitoring and support
- Quick bug fixes
- User onboarding assistance

**Tasks:**
- Launch announcement
- Monitor app performance
- Respond to support requests
- Fix any critical bugs
- Gather initial feedback

---

## File Structure
```
tradie-app/
├── apps/
│   ├── mobile/                 # React Native / Expo
│   │   ├── app/               # Expo Router (file-based routing)
│   │   │   ├── (auth)/        # Auth screens
│   │   │   ├── (tabs)/        # Main app tabs
│   │   │   └── [id]/          # Dynamic routes
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── store/             # Zustand stores
│   │   └── package.json
│   │
│   └── web/                    # Next.js Backend
│       ├── app/               # Next.js App Router
│       │   ├── api/           # API routes
│       │   └── layout.tsx
│       ├── lib/
│       │   ├── auth/          # Clerk helpers
│       │   ├── stripe/
│       │   ├── xero/
│       │   ├── tallbob/
│       │   └── email/
│       └── package.json
│
├── packages/
│   ├── database/              # Drizzle schema & migrations
│   │   ├── schema/
│   │   │   ├── organizations.ts
│   │   │   ├── users.ts
│   │   │   ├── jobs.ts
│   │   │   ├── invoices.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   └── index.ts
│   │
│   ├── api-client/            # Shared API types & client
│   │   ├── types/
│   │   └── client.ts
│   │
│   ├── ui/                    # Shared components (optional)
│   │   └── components/
│   │
│   └── utils/                 # Shared utilities
│       └── validation.ts      # Zod schemas
│
├── .env.example
├── package.json
├── turbo.json
└── README.md

Environment Variables
bash# Database
DATABASE_URL=postgresql://...

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Tall Bob SMS
TALLBOB_API_KEY=...
TALLBOB_API_URL=https://...
TALLBOB_WEBHOOK_SECRET=...

# Xero
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback

# File Storage (Vercel Blob)
BLOB_READ_WRITE_TOKEN=...

# Email (Resend)
RESEND_API_KEY=re_...

# App URLs
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_WEB_URL=https://api.yourdomain.com

# Feature Flags (optional)
ENABLE_SUBSCRIPTIONS=false
ENABLE_XERO=true
ENABLE_TWO_WAY_SMS=true

Success Metrics
User Onboarding

Owner completes signup in < 3 minutes
First job created within 10 minutes
First team member invited within first session

Core Usage

Average 10+ jobs created per organization per month
80%+ of jobs have time logs
70%+ of completed jobs invoiced within 7 days

Financial

SMS credit purchase conversion: 50%+ of active orgs
Average SMS spend: $10-30/month per org
Invoice payment recorded within 14 days average

Technical

App load time < 2 seconds
Xero sync success rate > 98%
SMS delivery rate > 99%
Crash-free rate > 99.5%

Satisfaction

App Store rating: 4.5+ stars
User retention: 80% after 30 days
NPS score: 50+


Risk Mitigation
Technical Risks

Xero API changes: Monitor Xero developer updates, build abstraction layer
SMS delivery failures: Implement retry logic, status monitoring, alternative providers
Performance with large datasets: Pagination, lazy loading, database indexing
Multi-tenancy data leaks: Comprehensive RLS, automated tests, security audits

Business Risks

Low adoption: Focus on onboarding UX, user feedback, marketing
High SMS costs: Monitor usage patterns, optimize messaging, transparent pricing
Competitor features: Iterative development, user-requested features prioritized
Regulation changes (accounting/GST): Flexible schema, compliance monitoring

Operational Risks

Support burden: Comprehensive help docs, in-app guidance, community forum
Scaling issues: Serverless architecture scales automatically, monitor costs
Data loss: Daily backups, point-in-time recovery (Neon feature)


Future Enhancements (Post-Launch)
Phase 2 Features:

Online payments (Stripe invoice links)
Client portal (view jobs/invoices/quotes)
Recurring jobs and invoices
Inventory management
Purchase orders
Supplier management
Advanced reporting (profit margins, forecasting)
Mobile app white-labeling
API for third-party integrations
Offline mode
iOS/Android widgets
Apple Watch / Android Wear companion

Integrations:

MYOB integration
QuickBooks integration
ServiceM8 data import
Google Calendar sync
Slack notifications
Zapier integration

Advanced Features:

AI-powered job costing predictions
Route optimization for scheduling
Automated appointment booking (client-facing)
Time tracking via GPS geofencing
Voice-to-text job notes
Job site checklist templates marketplace
Compliance document scanning (OCR)
Customer feedback/ratings system


Questions for Clarification

Tall Bob API: Do you have the full API documentation ready to share? Need to understand:

Authentication method
Send SMS endpoint
Inbound webhook payload format
Delivery status webhook format
Number provisioning process


SMS Number Provisioning: How do organizations/users get their Tall Bob SMS numbers?

Automatic during signup?
Manual admin setup?
Cost involved?


Subscription Model: Even though free/low-cost, should we build infrastructure now?

Free tier limits (users, jobs, SMS)?
Paid tier pricing (if any)?
Stripe subscription setup?


Initial Target Market: Focus on specific trade (e.g., electricians) or all trades?

Affects terminology, templates, checklist defaults


MYOB/QuickBooks: Build after Xero is stable, or parallel development?
Beta Testing: Do you have existing contacts/tradespeople to beta test?


Next Steps to Start Development

Confirm Tech Stack: Approve React Native + Expo + Next.js + Neon + Drizzle
Share Tall Bob Docs: Provide API documentation for SMS integration
Create Accounts:

Clerk account (authentication)
Neon account (database)
Vercel account (deployment)
Stripe account (payments)
Xero Developer account
Tall Bob account


