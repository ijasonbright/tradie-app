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
Migrations: Drizzle Kit (apply via https://tradie-app-web.vercel.app/dashboard/migrate)
Security: Row Level Security (RLS) for multi-tenancy

**IMPORTANT - Database Migrations:**
- Generate migration: `cd packages/database && npx drizzle-kit generate`
- Apply migration: Navigate to https://tradie-app-web.vercel.app/dashboard/migrate
- DO NOT use `drizzle-kit push` or local migration scripts

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

#### 4. Request and Response Format: Use snake_case EVERYWHERE

**WHY:** Database columns use snake_case. To maintain consistency and eliminate conversion overhead, the entire stack now uses snake_case.

**STANDARD:** snake_case for ALL data:
- Mobile app → API: snake_case
- API → Database: snake_case (no conversion needed)
- Database → API: snake_case
- API → Mobile app: snake_case

**Request Body (Mobile → API):**
```typescript
// Mobile app sends
const data = {
  organization_id: orgId,
  client_id: clientId,
  site_address_line1: address,
  quoted_amount: amount,
}
await apiClient.createJob(data)
```

**API Endpoint Receives:**
```typescript
const body = await req.json()
const orgId = body.organization_id        // ✓ snake_case
const clientId = body.client_id            // ✓ snake_case
const address = body.site_address_line1    // ✓ snake_case
const amount = body.quoted_amount          // ✓ snake_case
```

**API Response (API → Mobile):**
```typescript
return NextResponse.json({
  organization_id: orgId,
  invoice_reminders_enabled: true,
  reminder_days_before_due: '7,3,1',
  created_at: new Date().toISOString(),
})
```

**WRONG (DO NOT USE):**
```typescript
// ❌ DO NOT use camelCase anywhere
const data = {
  organizationId: orgId,          // ❌ camelCase - API will not recognize
  clientId: clientId,              // ❌ camelCase - API will not recognize
  siteAddressLine1: address,       // ❌ camelCase - API will not recognize
  quotedAmount: amount,            // ❌ camelCase - API will not recognize
}
```

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
| `API Error: 400 Missing required fields` | Mobile app sending camelCase, API expecting snake_case | Use snake_case in mobile app requests |
| Mobile app can't read fields | Mobile app trying to read camelCase fields | API always returns snake_case - read snake_case fields |
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


---

## FEATURE ROADMAP: Next Phase Features

This section outlines the next major features to be implemented after the core MVP. These features enhance automation, user experience, and business intelligence.

### 1. Intelligent Notifications System

A comprehensive notification system that keeps team members informed and helps catch important events before they become problems.

#### Database Schema

**notification_settings**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- notification_type (appointment/job_completion_pending_invoice/overdue_invoice/document_expiry/payment_received/team_workload/client_communication)
- enabled (boolean, default true)
- delivery_methods (jsonb: {push: true, email: true, sms: false})
- recipients (jsonb: {roles: ['owner', 'admin'], user_ids: ['uuid1', 'uuid2']})
- conditions (jsonb: varies by type)
- created_at, updated_at
```

**notification_log**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- notification_type
- recipient_user_id (FK → users)
- delivery_method (push/email/sms)
- status (sent/delivered/failed/read)
- subject
- message_body
- related_entity_type (job/invoice/appointment/document)
- related_entity_id (uuid)
- sent_at, delivered_at, read_at
- created_at
```

#### Notification Types

**1. Appointment Reminders**
- **Trigger:** 24 hours, 2 hours, 30 minutes before appointment
- **Recipients:** Assigned team member(s)
- **Channels:** Push notification, optional SMS
- **Conditions:** Can customize reminder times per appointment type
- **Message:** "Reminder: [Appointment Title] at [Location] starts in [Time]"

**2. Job Completion Pending Invoice**
- **Trigger:** Job status = "completed" AND no invoice linked AND X days passed
- **Recipients:** Owner, Admin, or specific users
- **Channels:** Push + Email (daily digest)
- **Conditions:** Customizable delay (default 2 days)
- **Message:** "Job #[Number] completed [X] days ago but no invoice created. Client: [Name]"

**3. Overdue Invoice Alert (Internal)**
- **Trigger:** Invoice.due_date < today AND status != 'paid'
- **Recipients:** Owner, Admin
- **Channels:** Push + Email (daily digest)
- **Conditions:** Group by days overdue (1-7, 8-14, 15-30, 30+)
- **Message:** "Invoice #[Number] is [X] days overdue. Client: [Name]. Amount: $[Total]"

**4. Document/Compliance Expiry Warnings**
- **Types:**
  - Organization documents (insurance, licenses)
  - User documents (trade licenses, certifications, driver's license)
  - Equipment certifications (future)
- **Triggers:**
  - 30 days before expiry (warning)
  - 14 days before expiry (urgent)
  - 7 days before expiry (critical)
  - 1 day before expiry (final warning)
  - Day of expiry (expired)
- **Recipients:**
  - Organization docs → Owner + Admin
  - User docs → User + Owner/Admin
- **Channels:** Push + Email
- **Message:** "⚠️ [Document Type] for [Name] expires in [X] days. Renew now to avoid compliance issues."

**5. Payment Received**
- **Trigger:** Invoice payment recorded
- **Recipients:** Owner, Admin, job creator
- **Channels:** Push notification
- **Message:** "Payment received: $[Amount] for Invoice #[Number] from [Client Name]"

**6. Team Workload Alerts**
- **Trigger:** Team member assigned jobs > threshold (e.g., 10 active jobs)
- **Recipients:** Owner, Admin
- **Channels:** Push + Email (weekly digest)
- **Conditions:** Customizable threshold per role
- **Message:** "[Employee Name] has [X] active jobs. Consider redistributing workload."

**7. Client Communication Response Time**
- **Trigger:** Inbound SMS or email from client not replied to in X hours
- **Recipients:** Assigned team member, Owner/Admin
- **Channels:** Push notification
- **Conditions:** Customizable delay (default 4 hours)
- **Message:** "Client [Name] sent a message [X] hours ago. No response yet."

**8. Quote Expiry Reminder**
- **Trigger:** Quote.valid_until_date approaching (3 days, 1 day)
- **Recipients:** Quote creator, Owner/Admin
- **Channels:** Push notification
- **Message:** "Quote #[Number] for [Client] expires in [X] days. Follow up?"

**9. Job Status Updates**
- **Trigger:** Job status changes (quoted → scheduled → in_progress → completed)
- **Recipients:** Job creator, assigned team, Owner/Admin
- **Channels:** Push notification
- **Message:** "Job #[Number] status changed to [Status] by [User]"

**10. Material/Time Log Approval Queue**
- **Trigger:** Pending approvals > threshold (e.g., 5 items) OR oldest pending > X days
- **Recipients:** Owner, Admin (who can approve)
- **Channels:** Push + Email (daily digest)
- **Message:** "[X] items pending approval. Oldest from [Date]."

**11. Low SMS Credits**
- **Trigger:** SMS credits < 20 (warning), < 10 (urgent)
- **Recipients:** Owner, Admin
- **Channels:** Push + Email
- **Message:** "⚠️ Low SMS credits: [X] remaining. Buy more to continue sending messages."

**12. Recurring Job Due Reminder (Internal)**
- **Trigger:** Recurring job template due for next occurrence (see Cyclical Jobs section)
- **Recipients:** Owner, Admin
- **Channels:** Push + Email
- **Message:** "Recurring service due: [Service Name] for [Client]. Create job or send reminder?"

**13. Subcontractor Payment Due**
- **Trigger:** Subcontractor owed_amount > threshold (e.g., $1000) OR X days since last payment
- **Recipients:** Owner, Admin
- **Channels:** Push + Email (weekly digest)
- **Message:** "[Subcontractor Name] is owed $[Amount]. Last payment [X] days ago."

**14. Job Without Assigned Team Member**
- **Trigger:** Job created without assigned_to_user_id AND scheduled_date < 7 days away
- **Recipients:** Owner, Admin
- **Channels:** Push notification
- **Message:** "Job #[Number] scheduled for [Date] has no assigned team member"

**15. Client Feedback Request**
- **Trigger:** Job status = "completed" + invoice paid + X days passed
- **Recipients:** Owner, Admin (internal notification to send feedback request)
- **Channels:** Push notification
- **Conditions:** Customizable delay (default 3 days after payment)
- **Message:** "Job #[Number] completed and paid. Request feedback from [Client]?"

#### Settings UI (Mobile + Web)

**Notifications Settings Screen:**
- List all notification types with toggles
- Each notification shows:
  - Toggle: Enabled/Disabled
  - Delivery methods: Push, Email, SMS
  - Recipients (roles + specific users)
  - Conditions (times, thresholds)
- "Test Notification" button
- "Reset to Defaults" option

**Notification Center (Mobile):**
- Inbox-style list of all notifications
- Filter by: All, Unread, Type, Date
- Mark as read/unread
- Tap to navigate to related entity (job, invoice, etc.)
- Badge count on app icon
- Pull to refresh

**Email Digest Options:**
- Daily summary (choose time)
- Weekly summary (choose day + time)
- Instant (real-time emails)
- Group by type or priority

---

### 2. Cyclical Job Automation (Recurring Services)

Automates recurring maintenance services with client approval workflow to increase retention and reduce manual scheduling.

#### Database Schema

**recurring_job_templates**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- client_id (FK → clients)
- template_name (e.g., "Annual A/C Service - John Doe")
- job_type (maintenance/inspection/etc.)
- description
- site_address_line1, site_address_line2, site_city, site_state, site_postcode
- site_access_notes
- assigned_to_user_id (FK → users, nullable)
- quoted_amount (decimal)
- estimated_duration_hours
- recurrence_pattern (monthly/quarterly/biannually/annually/custom)
- recurrence_interval (integer, e.g., 3 for every 3 months)
- recurrence_day_of_month (1-31, nullable)
- recurrence_month_of_year (1-12, nullable, for annual)
- next_due_date (date, calculated)
- last_job_created_date (date, nullable)
- auto_create_jobs (boolean, default false) // if true, skip client approval
- client_approval_required (boolean, default true)
- approval_reminder_days_before (integer, default 14)
- status (active/paused/cancelled)
- created_by_user_id (FK → users)
- created_at, updated_at
```

**recurring_job_instances**
```
- id (uuid, PK)
- template_id (FK → recurring_job_templates)
- organization_id (FK → organizations)
- scheduled_date (date, when service is due)
- approval_status (pending/approved/declined/auto_created)
- approval_requested_at
- approved_at
- declined_at
- decline_reason
- client_response_token (uuid, unique, for approval link)
- job_id (FK → jobs, nullable) // linked after client approves or admin creates
- created_at, updated_at
```

**recurring_job_history**
```
- id (uuid, PK)
- template_id (FK → recurring_job_templates)
- instance_id (FK → recurring_job_instances)
- job_id (FK → jobs)
- scheduled_date
- completed_date
- invoice_id (FK → invoices, nullable)
- total_amount (decimal, nullable)
- client_satisfaction (1-5, nullable, future)
- created_at
```

#### Workflow

**1. Creating Recurring Service Template:**
- Navigate to client profile or jobs screen
- "Create Recurring Service" button
- Form fields:
  - Service name/description
  - Job type
  - Address (pre-filled from client or custom)
  - Assigned team member (optional)
  - Estimated cost
  - Estimated duration
  - Recurrence pattern:
    - Monthly (every X months)
    - Quarterly (every 3 months)
    - Biannually (every 6 months)
    - Annually (specify month)
    - Custom (advanced cron-like)
  - Next due date (auto-calculated or manual)
  - Auto-create jobs (toggle)
    - If ON: Jobs created automatically without client approval
    - If OFF: Send approval request to client X days before
- Save template

**2. Automated Reminder & Approval Flow:**

**14 Days Before Due Date (configurable):**
- System identifies recurring_job_instances with scheduled_date = today + 14 days AND approval_status = 'pending'
- Sends approval request to client:
  - **Email:**
    - Subject: "Approve Your Upcoming [Service Name] - [Business Name]"
    - Body: Personalized message with service details, date, cost
    - Two buttons: "Approve Service" | "Decline or Reschedule"
    - Links contain unique `client_response_token`
  - **SMS (costs credits, optional):**
    - "Hi [Client], your [Service] is due on [Date]. Approve here: [Short Link]. - [Business]"

**Client Clicks "Approve":**
- Redirects to simple approval page (no login required, uses token)
- Shows service details
- "Confirm Approval" button
- On confirm:
  - Updates `approval_status = 'approved'`
  - Creates job automatically:
    - Pre-fills from template
    - Status = 'scheduled'
    - Links to recurring_job_instance
  - Sends confirmation SMS/Email to client
  - Notifies team member (push notification)
  - Adds to team calendar

**Client Clicks "Decline or Reschedule":**
- Redirects to reschedule page
- Options:
  - "Not needed this time" (skip this instance)
  - "Reschedule to different date" (date picker)
  - "Cancel recurring service" (stop future reminders)
- Free text reason field (optional)
- On submit:
  - Updates `approval_status = 'declined'`
  - Records decline_reason
  - Notifies Owner/Admin (push + email)
  - If rescheduled: updates scheduled_date
  - If cancelled: updates template status = 'cancelled'

**7 Days Before Due Date:**
- If still pending, send second reminder (email only to reduce SMS costs)

**On Due Date (if still pending):**
- Notify Owner/Admin: "Recurring service approval pending for [Client]. Follow up?"
- Owner/Admin can manually create job or skip

**Auto-Create Mode:**
- If template.auto_create_jobs = true:
  - Job created automatically 14 days before due date
  - No client approval required
  - Client receives notification: "Your [Service] has been scheduled for [Date]. See you then!"

**3. Admin Dashboard for Recurring Services:**

**Recurring Services List:**
- Shows all active templates
- Columns: Client, Service, Next Due, Status, Actions
- Filter by: Active, Paused, Cancelled
- Search by client name

**Template Detail View:**
- Shows all past instances (completed jobs)
- Upcoming instances (pending approval, approved, auto-created)
- Performance metrics:
  - Approval rate (% of approvals vs declines)
  - Average revenue per service
  - Client retention (how long active)
- Edit template button
- Pause/Resume toggle
- Cancel template button

**Upcoming Approvals Queue:**
- Calendar view or list view
- Shows instances awaiting approval
- Days until due
- Last reminder sent
- Quick actions: Send reminder, Create job manually, Skip instance

**4. Client-Facing Approval Page:**

**Design:**
- Clean, mobile-friendly
- Business logo + name
- Service details card:
  - Service name
  - Scheduled date
  - Estimated duration
  - Quoted price
  - Assigned team member (name + photo)
- Site address
- "What's included" section (from template description)
- Two large buttons: "Approve Service" | "Decline or Reschedule"
- No login required (uses secure token)

**After Approval:**
- Thank you message
- "Your service is confirmed for [Date]"
- Option to add to calendar (Google/Apple)
- Business contact info

**5. Smart Scheduling Suggestions:**

**For Owner/Admin:**
- When creating template, suggest optimal recurrence based on:
  - Industry standards (e.g., HVAC maintenance = annual)
  - Past job frequency for this client
  - Equipment manufacturer recommendations (future)
- "Most common for [Service Type]: Every X months"

**For Clients:**
- In approval email, show: "Last service was [X] months ago on [Date]"
- If equipment warranty requires regular service, note: "⚠️ Regular service required to maintain warranty"

#### API Endpoints
```
GET    /api/recurring-jobs/templates
POST   /api/recurring-jobs/templates
GET    /api/recurring-jobs/templates/:id
PUT    /api/recurring-jobs/templates/:id
DELETE /api/recurring-jobs/templates/:id
POST   /api/recurring-jobs/templates/:id/pause
POST   /api/recurring-jobs/templates/:id/resume

GET    /api/recurring-jobs/instances/upcoming
GET    /api/recurring-jobs/instances/:id
POST   /api/recurring-jobs/instances/:id/send-reminder
POST   /api/recurring-jobs/instances/:id/create-job

GET    /api/recurring-jobs/client-approval/:token
POST   /api/recurring-jobs/client-approval/:token/approve
POST   /api/recurring-jobs/client-approval/:token/decline

GET    /api/recurring-jobs/history/:templateId
```

#### Mobile UI Screens

**1. Recurring Services Tab (Owner/Admin):**
- List of all templates
- "Add Recurring Service" FAB
- Quick stats: X active services, Y pending approvals

**2. Create/Edit Recurring Service Form:**
- Stepper/wizard:
  - Step 1: Service Details
  - Step 2: Recurrence Pattern
  - Step 3: Client Approval Settings
  - Step 4: Review & Save

**3. Recurring Service Detail:**
- Template info
- Upcoming instance (next due)
- History (past 5 jobs)
- Edit/Pause/Cancel buttons

**4. Approvals Queue:**
- List of pending approvals
- Shows: Client, Service, Due Date, Days Left
- "Send Reminder" and "Create Job" actions

---

### 3. Job Completion Forms & PDF Reports

Customizable completion forms that tradies fill out after finishing a job, generating professional PDF reports to send with invoices.

#### Database Schema

**completion_form_templates**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- template_name (e.g., "Plumbing Job Completion", "HVAC Maintenance Report")
- job_type (nullable, if specific to job type)
- description
- sections (jsonb array of form sections)
  [
    {
      section_name: "Work Performed",
      fields: [
        {field_type: "text", label: "Summary", required: true},
        {field_type: "checklist", label: "Tasks Completed", options: ["Inspected pipes", "Fixed leak", "Tested pressure"]},
        {field_type: "textarea", label: "Additional Notes"}
      ]
    },
    {
      section_name: "Materials Used",
      fields: [
        {field_type: "table", columns: ["Item", "Quantity", "Part Number"]}
      ]
    },
    {
      section_name: "Safety & Compliance",
      fields: [
        {field_type: "checkbox", label: "Site left clean and tidy"},
        {field_type: "checkbox", label: "Safety tags installed where required"},
        {field_type: "signature", label: "Technician Signature"}
      ]
    }
  ]
- include_photos (boolean, default true)
- include_before_after_photos (boolean, default true)
- include_signature (boolean, default true) // client signature
- pdf_template_id (FK → pdf_templates, nullable) // for custom PDF styling
- is_default (boolean)
- created_by_user_id (FK → users)
- created_at, updated_at
```

**job_completion_forms**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- job_id (FK → jobs)
- template_id (FK → completion_form_templates)
- completed_by_user_id (FK → users)
- completion_date
- form_data (jsonb, stores all field responses)
- client_signature_url (nullable, Vercel Blob)
- technician_signature_url (nullable, Vercel Blob)
- pdf_url (nullable, generated PDF stored in Vercel Blob)
- sent_to_client (boolean, default false)
- sent_at (nullable)
- created_at, updated_at
```

**pdf_templates**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- template_name
- template_type (completion_report/invoice/quote)
- header_html (nullable, custom header)
- footer_html (nullable, custom footer)
- styles (jsonb: {primaryColor, fontFamily, logoPosition, etc.})
- created_at, updated_at
```

#### Field Types Supported

**Input Types:**
1. **text**: Short text input (e.g., "Job Address")
2. **textarea**: Long text input (e.g., "Work Summary")
3. **number**: Numeric input (e.g., "Water Pressure Reading")
4. **date**: Date picker (e.g., "Completion Date")
5. **time**: Time picker (e.g., "Start Time")
6. **checkbox**: Single yes/no (e.g., "Safety Inspection Complete")
7. **checklist**: Multiple checkboxes (e.g., "Tasks Completed")
8. **dropdown**: Select one option (e.g., "Job Result: Successful/Needs Follow-up/Incomplete")
9. **radio**: Radio buttons (e.g., "Equipment Condition: Good/Fair/Poor/Replace")
10. **table**: Dynamic table (e.g., materials used, readings taken)
11. **signature**: Signature pad (client or technician)
12. **photo**: Photo upload (links to job_photos table)
13. **rating**: Star rating (e.g., "Client Satisfaction")

#### Workflow

**1. Creating Completion Form Template (Owner/Admin):**
- Navigate to Settings → Completion Forms
- "Create New Template" button
- Form builder UI:
  - Template name
  - Associated job type (optional filter)
  - Add sections:
    - Section title
    - Add fields (drag-and-drop or click to add)
    - Reorder fields
    - Set required fields
  - Preview form
- Save template
- Set as default for specific job types (optional)

**2. Completing Job Form (Mobile - Technician):**

**When Job Status = "Completed":**
- System prompts: "Fill out completion form?"
- Or navigate to job → "Completion Form" tab
- Select template (if multiple available) or use default
- Fill out form:
  - Each section displayed as a card
  - Required fields marked with *
  - Signature pads for client + technician
  - Add photos (or link existing job photos)
  - Auto-populate data where possible:
    - Materials from job_materials table
    - Time from time logs
    - Photos from job_photos
- "Save Draft" (in progress)
- "Submit" (final)

**After Submission:**
- Form data saved to job_completion_forms table
- Generate PDF in background (serverless function)
- Notify admin: "Completion form submitted for Job #[Number]"
- Update job status (if not already completed)
- Optionally attach PDF to invoice automatically

**3. PDF Generation:**

**Process:**
- Use Puppeteer or similar to generate PDF from HTML template
- PDF includes:
  - **Header:**
    - Business logo
    - Business name, ABN, contact details
    - "Job Completion Report" title
  - **Job Details:**
    - Job number, date
    - Client name, address
    - Assigned technician
  - **Form Sections:**
    - Each section as a distinct block
    - Formatted responses (tables, checklists, text)
  - **Photos:**
    - Before/After side-by-side if applicable
    - Grid layout for multiple photos
    - Captions
  - **Signatures:**
    - Technician signature with name + date
    - Client signature with name + date (if captured)
  - **Footer:**
    - Page numbers
    - Generated timestamp
    - Custom footer text
- Store PDF in Vercel Blob
- Link to job

**4. Sending Completion Report:**

**Manual Send:**
- Job detail screen → "Completion Report" tab
- "Send to Client" button
- Options:
  - Email only (free)
  - Email + SMS (costs credits)
- Preview PDF before sending
- Custom message (optional)
- Send

**Automatic Attachment to Invoice:**
- When invoice created from job:
  - If completion form exists → attach PDF to invoice email
  - Checkbox: "Include completion report"
  - PDF embedded in email or attached

**Client Receives:**
- Email with professional PDF attachment
- Can download, save, print
- Link to view online (future: client portal)

**5. Pre-built Templates for Common Trades:**

**Plumbing:**
- Work Summary
- Materials Used (table)
- Fixtures Installed/Repaired (checklist)
- Water Pressure Readings (before/after)
- Leak Test Results
- Safety Compliance (backflow prevention, tags, etc.)
- Client Signature

**Electrical:**
- Work Performed
- Circuits Modified (table: circuit #, description, load)
- Test Results (insulation resistance, earth continuity)
- Safety Switch Testing
- Compliance Certificate Details
- Wiring Diagrams (photos)
- Client Signature

**HVAC:**
- Service Type (maintenance/repair/installation)
- Equipment Details (make, model, serial #)
- Refrigerant Levels (before/after)
- Filter Replacement
- Performance Test Results (airflow, temperature)
- Recommendations
- Next Service Due Date
- Client Signature

**General Maintenance:**
- Tasks Completed (checklist)
- Materials Used
- Issues Found
- Recommendations
- Photos
- Client Signature

**Custom:**
- Blank template to build from scratch

**6. Admin Review & Analytics:**

**Completion Forms Dashboard:**
- List of all completed forms
- Filter by: date range, technician, job type
- Search by client or job number
- Export to CSV

**Individual Form View:**
- Full form data displayed
- PDF preview/download
- Edit (if needed, creates new version)
- Resend to client

**Analytics (Future):**
- Average completion time (job start → form submitted)
- Most common issues found
- Client satisfaction ratings (if included in form)
- Compliance metrics (% of jobs with all safety checks completed)

#### Mobile UI

**1. Completion Form Builder (Owner/Admin):**
- Web-based drag-and-drop form builder
- Mobile view for previewing
- Not practical to build complex forms on mobile

**2. Completion Form Fill-out (Technician - Mobile):**
- Clean, single-column layout
- One section at a time (or all sections scrollable)
- Large touch targets for checkboxes, buttons
- Signature pads optimized for mobile
- Photo uploads with camera integration
- Auto-save drafts
- Validation messages for required fields

**3. Completion Form View (Read-only):**
- Formatted display of completed form
- PDF download button
- "Send to Client" button

#### API Endpoints
```
GET    /api/completion-forms/templates
POST   /api/completion-forms/templates
GET    /api/completion-forms/templates/:id
PUT    /api/completion-forms/templates/:id
DELETE /api/completion-forms/templates/:id

GET    /api/jobs/:jobId/completion-form
POST   /api/jobs/:jobId/completion-form
PUT    /api/jobs/:jobId/completion-form/:formId
GET    /api/jobs/:jobId/completion-form/:formId/pdf
POST   /api/jobs/:jobId/completion-form/:formId/send

GET    /api/completion-forms (list all for organization)
```

---

### 4. Online Job Request Form (Embeddable)

A customizable web form that organizations can embed on their website, allowing clients to request jobs online with optional deposit payments.

#### Database Schema

**job_request_forms**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- form_name (e.g., "Emergency Call-Out", "Free Quote Request")
- slug (unique, for public URL: app.com/request/acme-plumbing-quote)
- description (shown to client)
- is_active (boolean)
- require_account (boolean, default false) // if true, client must create account
- approval_required (boolean, default true) // if true, job created as draft, needs admin approval
- // Branding
- primary_color
- logo_url
- header_text
- footer_text
- // Fields
- enabled_fields (jsonb array of field configs)
  [
    {field: "client_type", enabled: true, required: false},
    {field: "company_name", enabled: true, required: false},
    {field: "first_name", enabled: true, required: true},
    {field: "last_name", enabled: true, required: true},
    {field: "email", enabled: true, required: true},
    {field: "phone", enabled: true, required: true},
    {field: "address", enabled: true, required: true},
    {field: "job_description", enabled: true, required: true},
    {field: "preferred_date", enabled: true, required: false},
    {field: "urgency", enabled: true, required: false},
    {field: "photos", enabled: true, required: false},
    // Custom fields
    {field: "custom_1", enabled: true, required: false, label: "Property Type", type: "dropdown", options: ["House", "Apartment", "Commercial"]}
  ]
- // Service Presets (optional, for fixed-price services)
- service_presets_enabled (boolean, default false)
- service_presets (jsonb array)
  [
    {
      id: "preset1",
      name: "Blocked Drain - Standard",
      description: "Clear standard blockage",
      price: 150.00,
      deposit_required: true,
      deposit_percentage: 50,
      deposit_amount: 75.00
    },
    {
      id: "preset2",
      name: "Emergency Call-Out (After Hours)",
      description: "Immediate response 24/7",
      price: 350.00,
      deposit_required: true,
      deposit_percentage: 100,
      deposit_amount: 350.00,
      requires_full_payment: true
    }
  ]
- // Payment
- accept_deposits (boolean, default false)
- stripe_connected (boolean)
- deposit_percentage (integer, default 50) // if no service presets
- // Notifications
- notification_email (nullable, override default org email)
- notification_sms_enabled (boolean, uses org SMS credits)
- notification_users (jsonb array of user IDs to notify)
- // Spam Prevention
- enable_recaptcha (boolean, default true)
- rate_limit_per_ip (integer, default 3 per hour)
- // Tracking
- submission_count (integer, default 0)
- conversion_count (integer, default 0) // submissions that became jobs
- created_at, updated_at
```

**job_request_submissions**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- form_id (FK → job_request_forms)
- submission_token (uuid, unique)
- // Client Data
- client_type (residential/commercial)
- company_name (nullable)
- first_name
- last_name
- email
- phone
- mobile
- address_line1, address_line2, city, state, postcode
- // Job Data
- job_description
- preferred_date (nullable)
- urgency (low/medium/high/emergency)
- service_preset_id (nullable)
- custom_fields (jsonb, stores custom field responses)
- photo_urls (jsonb array)
- // Payment
- deposit_required (boolean)
- deposit_amount (decimal, nullable)
- deposit_paid (boolean, default false)
- stripe_payment_intent_id (nullable)
- paid_at (nullable)
- // Status
- status (pending/approved/declined/converted)
- approval_notes (text, nullable)
- approved_by_user_id (FK → users, nullable)
- approved_at (nullable)
- declined_reason (text, nullable)
- // Linked Records
- client_id (FK → clients, nullable) // after conversion
- job_id (FK → jobs, nullable) // after conversion
- // Metadata
- ip_address
- user_agent
- referrer_url
- utm_source, utm_medium, utm_campaign (for tracking marketing)
- created_at, updated_at
```

**job_request_analytics**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- form_id (FK → job_request_forms)
- date (date)
- views (integer, how many times form loaded)
- submissions (integer, how many submitted)
- conversion_rate (decimal, submissions/views)
- deposits_collected (decimal)
- jobs_created (integer)
- created_at
```

#### Workflow

**1. Creating Job Request Form (Owner/Admin):**

**Form Builder (Web Interface):**
- Navigate to Settings → Online Forms
- "Create New Form" button
- Configuration wizard:

  **Step 1: Basic Info**
  - Form name (internal)
  - Public slug (e.g., "emergency-plumbing")
  - Description (shown to clients)
  - Active toggle

  **Step 2: Branding**
  - Upload logo
  - Choose primary color
  - Header text (e.g., "Request a Quote")
  - Footer text (e.g., "We'll respond within 2 hours")

  **Step 3: Form Fields**
  - Enable/disable standard fields
  - Mark required fields
  - Add custom fields:
    - Field label
    - Field type (text, dropdown, checkbox, etc.)
    - Options (for dropdown/radio)
    - Required toggle
  - Drag to reorder

  **Step 4: Service Presets (Optional)**
  - Toggle: Enable service presets
  - Add preset:
    - Service name
    - Description
    - Price
    - Require deposit (toggle)
    - Deposit amount or percentage
    - Photo/icon
  - Clients can choose preset or "Custom Request"

  **Step 5: Payment Settings**
  - Accept deposits (toggle)
  - If enabled:
    - Connect Stripe (if not already)
    - Default deposit percentage (if no presets)
    - Full payment or deposit
  - Payment confirmation message

  **Step 6: Notifications**
  - Who gets notified when submission received:
    - All owners/admins (default)
    - Specific users (multi-select)
  - Email notification (always)
  - SMS notification (toggle, costs credits)
  - Custom notification email address

  **Step 7: Spam Prevention**
  - Enable reCAPTCHA (recommended)
  - Rate limiting (X submissions per IP per hour)

  **Step 8: Review & Embed**
  - Preview form
  - Get embed code:
    - iFrame embed
    - Direct link
    - WordPress plugin (future)
  - QR code (for print materials)
  - Save and activate

**2. Client Submits Job Request:**

**Client Experience:**
- Visits form (embedded on business website or standalone link)
- Sees professional, branded form
- Fills out required fields:
  - Contact info
  - Job description
  - Upload photos (optional)
  - Preferred date (optional)
  - Urgency level
- If service presets enabled:
  - Selects preset service OR "Custom Request"
  - Sees price upfront
- If deposit required:
  - Reviews deposit amount
  - "Proceed to Payment" button
  - Redirects to Stripe Checkout
  - Enters payment details
  - Payment processed
  - Returns to confirmation page
- If no deposit:
  - "Submit Request" button
  - Confirmation page immediately
- Confirmation message:
  - "Thank you! We've received your request."
  - "We'll contact you within [X] hours."
  - Submission reference number
  - Copy sent to email

**Confirmation Email to Client:**
- Subject: "Request Received - [Business Name]"
- Body:
  - Thank you message
  - Submission summary (fields submitted)
  - Deposit receipt (if paid)
  - What happens next
  - Contact info if questions
  - Business logo and branding

**3. Notification to Organization:**

**Instant Notification (when submission received):**
- **Push Notification:**
  - "New job request from [Client Name]"
  - Tap to view details
- **Email:**
  - Subject: "New Job Request: [Job Description]"
  - Body: Full submission details
  - Link to approve/view in app
- **SMS (optional, costs credits):**
  - "New job request from [Name]. View in app."

**4. Admin Reviews Submission (Mobile or Web):**

**Job Requests Queue:**
- Navigate to "Job Requests" tab/screen
- Shows pending submissions
- Filter by: All, Pending, Approved, Declined
- Sort by: Date, Deposit Paid, Urgency

**Submission Detail View:**
- Client contact info
- Job description
- Photos (if uploaded)
- Preferred date
- Service preset selected (if any)
- Deposit status (paid/not required)
- Custom field responses
- Map of address
- Actions:
  - **Approve & Create Job:**
    - Creates client record (if new)
    - Creates job with pre-filled data
    - Sends confirmation to client
    - Links submission to job
    - Status = "approved"
  - **Decline:**
    - Reason field (optional)
    - Sends decline email to client
    - Refunds deposit if paid (Stripe refund)
    - Status = "declined"
  - **Request More Info:**
    - Sends email/SMS to client
    - Keeps status = "pending"

**5. Creating Job from Submission:**

**Auto-Population:**
- Check if client exists (by email or phone)
- If exists: Link to existing client
- If new: Create client record with submitted data
- Create job:
  - Title = job_description (or service preset name)
  - Description = full job_description
  - Address from submission
  - Quoted amount = service preset price (if selected)
  - Status = "quoted" or "scheduled" (based on settings)
  - Created from job request (flag/tag)
- Link job to submission
- Send confirmation to client:
  - "Your request has been approved!"
  - Job details
  - Assigned team member (if assigned)
  - Scheduled date (if set)
  - Next steps

**6. Payment Handling:**

**Stripe Checkout Flow:**
- Client clicks "Proceed to Payment"
- Creates Stripe Payment Intent:
  - Amount = deposit_amount
  - Metadata: organization_id, submission_id, form_id
  - Description: "Deposit for [Service Name] - [Business Name]"
- Redirects to Stripe hosted checkout
- Client pays
- Stripe webhook → mark submission as paid
- Update deposit_paid = true
- Send receipt to client

**Refund (if declined):**
- Admin declines submission
- If deposit was paid:
  - Prompt: "Refund deposit?"
  - Creates Stripe refund
  - Email to client: "Your deposit has been refunded"

**7. Embed Options:**

**iFrame Embed:**
```html
<iframe src="https://app.tradieapp.com/request/acme-plumbing-quote" width="100%" height="800px" frameborder="0"></iframe>
```

**Direct Link:**
```
https://app.tradieapp.com/request/acme-plumbing-quote
```

**QR Code:**
- Generated QR code downloads as image
- Print on business cards, flyers, vehicle signage
- Scan → opens form on mobile

**WordPress Plugin (Future):**
- Install plugin
- Shortcode: `[tradie_form slug="acme-plumbing-quote"]`
- Fully integrated, matches WordPress theme

**8. Analytics & Tracking:**

**Form Analytics Dashboard:**
- Per form:
  - Total views (page loads)
  - Total submissions
  - Conversion rate (submissions / views)
  - Deposit collection rate
  - Jobs created from submissions
  - Revenue from deposits
- Time series chart (daily/weekly/monthly)
- Traffic sources (referrer URLs, UTM params)
- Most popular service presets
- Average time to approval

**Marketing Attribution:**
- Track UTM parameters in submission
- Report: "10 submissions from Google Ads campaign"
- ROI calculation: ad spend vs. jobs created

#### Mobile UI

**1. Job Requests Screen (Owner/Admin):**
- List of pending requests
- Badge count on tab
- Filter and search
- Tap to view detail

**2. Request Detail Screen:**
- Client info card
- Job description card
- Photos gallery
- Map with address pin
- Action buttons:
  - "Create Job" (primary)
  - "Decline"
  - "Contact Client"

**3. Form Management (Web Only):**
- Creating/editing forms too complex for mobile
- But can view form analytics on mobile

#### API Endpoints
```
GET    /api/job-request-forms
POST   /api/job-request-forms
GET    /api/job-request-forms/:id
PUT    /api/job-request-forms/:id
DELETE /api/job-request-forms/:id
GET    /api/job-request-forms/:slug/public (no auth, for client view)

POST   /api/job-request-forms/:slug/submit (public, with rate limiting)
GET    /api/job-request-forms/:formId/submissions
GET    /api/job-request-forms/:formId/submissions/:submissionId
POST   /api/job-request-forms/:formId/submissions/:submissionId/approve
POST   /api/job-request-forms/:formId/submissions/:submissionId/decline
POST   /api/job-request-forms/:formId/submissions/:submissionId/create-job

POST   /api/stripe/job-request-checkout (create payment intent)
POST   /api/webhooks/stripe/job-request (handle payment)

GET    /api/job-request-forms/:formId/analytics
```

---

### 5. Notification Preferences & Settings

**Per-User Notification Settings:**
- Users can customize which notifications they receive
- Channels: Push, Email, SMS (for critical alerts)
- Frequency: Instant, Daily Digest, Weekly Summary
- Do Not Disturb schedule (e.g., no push between 10pm-7am)

**Organization-Level Defaults:**
- Owner/Admin sets default notification settings for roles
- New team members inherit defaults
- Can override individually

**Notification Templates:**
- Customize message templates for each notification type
- Variables: {client_name}, {job_number}, {amount}, {date}, etc.
- Preview before saving

---

## Implementation Priority & Phasing

### Phase 1: Intelligent Notifications (4 weeks)
**Why First:**
- High impact, low complexity
- Enhances existing features without major schema changes
- Immediate user value (reduce missed appointments, unpaid invoices)

**Deliverables:**
- Database schema (notification_settings, notification_log)
- Notification engine (cron jobs for scheduled checks)
- Push notification infrastructure (Expo Push Notifications)
- Email digest system
- Mobile UI for notification center
- Settings screens for preferences

**Effort: Medium**

---

### Phase 2: Cyclical Job Automation (6 weeks)
**Why Second:**
- Directly increases revenue retention
- Moderately complex (approval workflow, recurrence logic)
- Builds on notification system

**Deliverables:**
- Database schema (recurring templates, instances, history)
- Recurrence calculation engine
- Client approval workflow (email/SMS with links)
- Public approval pages (no-login web pages)
- Admin dashboard for recurring services
- Mobile UI for creating/managing templates

**Effort: High**

---

### Phase 3: Job Completion Forms (5 weeks)
**Why Third:**
- Enhances professionalism and client trust
- PDF generation is moderately complex
- Can be built in parallel with Phase 2

**Deliverables:**
- Database schema (form templates, completed forms, PDF templates)
- Form builder UI (web)
- Mobile form fill-out UI
- PDF generation with Puppeteer
- Pre-built templates for common trades
- Email delivery with attachments

**Effort: High**

---

### Phase 4: Online Job Request Form (5 weeks)
**Why Fourth:**
- Customer-facing feature, high visibility
- Stripe integration for deposits
- Spam prevention critical
- Analytics for marketing attribution

**Deliverables:**
- Database schema (forms, submissions, analytics)
- Form builder UI (web)
- Public form pages (mobile-responsive)
- Stripe Checkout integration
- Admin approval workflow
- Embed code generation
- Analytics dashboard

**Effort: High**

---

## Success Metrics

**Intelligent Notifications:**
- 90%+ on-time appointment attendance
- 30% reduction in overdue invoices > 30 days
- 95% document compliance (no expired licenses)
- Notification engagement rate > 70%

**Cyclical Job Automation:**
- 50%+ of active organizations create at least 1 recurring service
- 70%+ client approval rate
- 20% increase in monthly recurring revenue per org
- 80%+ auto-renewal rate (clients don't cancel recurring services)

**Job Completion Forms:**
- 80%+ of completed jobs have a completion form
- 95%+ client satisfaction with PDF reports
- 50% reduction in post-job disputes ("he said, she said")
- Completion forms sent with 90%+ of invoices

**Online Job Request Form:**
- 10%+ conversion rate (views → submissions)
- 50%+ of submissions become jobs
- 30%+ deposit collection rate (for preset services)
- 5%+ increase in new client acquisition

---

## Technical Requirements

**Infrastructure:**
- **Cron Jobs:** Vercel cron for scheduled tasks (notification checks, recurring job instances)
- **PDF Generation:** Puppeteer in serverless function (or PDF service API)
- **Push Notifications:** Expo Push Notifications
- **Email Service:** Resend or SendGrid (already planned)
- **Stripe:** Already integrated for SMS credits, extend for deposits
- **Analytics:** Track events with Vercel Analytics or Mixpanel

**Security:**
- **Public Forms:** Rate limiting, reCAPTCHA, CSRF protection
- **Approval Tokens:** Secure, time-limited, single-use tokens for client approvals
- **PII Handling:** Encrypt sensitive client data in job_request_submissions

**Performance:**
- **PDF Generation:** Offload to background job (don't block UI)
- **Notification Delivery:** Queue system for bulk notifications (e.g., daily digest to 100 users)
- **Form Submissions:** Handle traffic spikes (public-facing forms)

---

### 6. Zapier Integration & Third-Party Automation

A comprehensive Zapier integration that enables users to connect the tradie app with 6,000+ other applications, automating workflows and extending functionality beyond the app.

#### Why Zapier Integration Matters

**Business Value:**
- 20-40% of power users typically adopt Zapier integrations
- Increases switching costs and reduces churn
- Major competitive differentiator
- Enables workflows impossible within the app alone
- Positions app as "connected hub" for trade businesses

**User Benefits:**
- Connect to CRM (HubSpot, Salesforce, Pipedrive)
- Sync with accounting (QuickBooks, FreshBooks, Wave)
- Automate project management (Asana, Trello, Monday.com)
- Email marketing (Mailchimp, ActiveCampaign)
- Communication (Slack, Microsoft Teams)
- And 6,000+ other apps

#### Database Schema

**zapier_api_keys**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- api_key (unique, hashed with SHA-256)
- api_key_prefix (for display, e.g., "zap_abc123...")
- name (user-defined name, e.g., "Main Automation Key")
- is_active (boolean, default true)
- last_used_at (nullable)
- created_by_user_id (FK → users)
- created_at, expires_at (nullable)
```

**zapier_subscriptions**
```
- id (uuid, PK)
- organization_id (FK → organizations)
- subscription_id (unique identifier from Zapier)
- event_type (job.created, invoice.paid, etc.)
- target_url (Zapier webhook URL)
- filters (jsonb, optional filters like job_type, status, etc.)
- is_active (boolean, default true)
- last_triggered_at (nullable)
- created_at, updated_at
```

**zapier_webhook_logs**
```
- id (uuid, PK)
- subscription_id (FK → zapier_subscriptions)
- organization_id (FK → organizations)
- event_type
- payload (jsonb, what was sent)
- target_url
- status_code (HTTP response code)
- response_body (text, nullable)
- delivery_duration_ms (integer)
- triggered_at
- retry_count (integer, default 0)
```

#### Trigger Types (Events that Start Zaps)

**High Priority Triggers (Phase 1):**

1. **New Job Created**
   - Event: `job.created`
   - Payload: Job details, client info, assigned user, scheduled date
   - Use Cases: Add to project management, create calendar events, notify team

2. **Invoice Paid**
   - Event: `invoice.paid`
   - Payload: Invoice details, payment amount, payment method, client info
   - Use Cases: Update accounting, send thank you emails, trigger rewards

3. **New Client Created**
   - Event: `client.created`
   - Payload: Client details, contact info, address
   - Use Cases: Add to CRM, start email sequences, create in accounting software

4. **Job Completed**
   - Event: `job.completed`
   - Payload: Job details, completion time, time logs, materials used
   - Use Cases: Trigger review requests, update project tracking, send completion reports

5. **Quote Accepted**
   - Event: `quote.accepted`
   - Payload: Quote details, client info, accepted amount
   - Use Cases: Sales conversion tracking, auto-create job, notify team

**Medium Priority Triggers (Phase 2):**

6. **Quote Sent**
   - Event: `quote.sent`
   - Payload: Quote details, client info, expiry date
   - Use Cases: Follow-up workflows, sales pipeline tracking

7. **Expense Submitted**
   - Event: `expense.submitted`
   - Payload: Expense details, receipt URL, submitter
   - Use Cases: Notify approvers, add to expense tracking, create approval workflow

8. **Time Log Submitted**
   - Event: `time_log.submitted`
   - Payload: Time log details, job info, hours worked
   - Use Cases: Payroll tracking, productivity monitoring

9. **Invoice Overdue**
   - Event: `invoice.overdue`
   - Payload: Invoice details, days overdue, client contact
   - Use Cases: Payment reminder workflows, escalation processes

10. **Appointment Scheduled**
    - Event: `appointment.scheduled`
    - Payload: Appointment details, assigned user, time/date
    - Use Cases: Calendar sync, team coordination, client reminders

**Low Priority Triggers (Phase 3):**

11. **Job Status Changed**
    - Event: `job.status_changed`
    - Payload: Job details, old status, new status, changed by
    - Use Cases: Workflow automation, progress tracking

12. **Payment Received (Partial)**
    - Event: `invoice.payment_partial`
    - Payload: Invoice details, payment amount, remaining balance
    - Use Cases: Track installments, send receipts

13. **Quote Rejected**
    - Event: `quote.rejected`
    - Payload: Quote details, rejection reason
    - Use Cases: Loss analysis, follow-up workflows

14. **Document Expiring Soon**
    - Event: `document.expiring`
    - Payload: Document details, expiry date, days until expiry
    - Use Cases: Compliance reminders, renewal workflows

15. **New SMS Received**
    - Event: `sms.received`
    - Payload: Message body, sender phone, conversation context
    - Use Cases: Client communication workflows, support ticketing

#### Action Types (Things Zapier Can Do)

**High Priority Actions (Phase 1):**

1. **Create Client**
   - Endpoint: `POST /api/clients`
   - Required: organization_id, client_type, name/company_name, email or phone
   - Returns: Created client object
   - Use Cases: Import from CRM, form submissions, marketing lists

2. **Create Job**
   - Endpoint: `POST /api/jobs`
   - Required: organization_id, client_id, title, job_type
   - Returns: Created job with job_number
   - Use Cases: Auto-create from emails, calendars, forms

3. **Create Invoice**
   - Endpoint: `POST /api/invoices`
   - Required: organization_id, client_id, issue_date, due_date
   - Returns: Created invoice with invoice_number
   - Use Cases: Automated billing, recurring invoices

4. **Send Invoice via Email**
   - Endpoint: `POST /api/invoices/[id]/send-email`
   - Required: invoice_id
   - Returns: Send status
   - Use Cases: Automated invoice delivery workflows

5. **Record Invoice Payment**
   - Endpoint: `POST /api/invoices/[id]/payments`
   - Required: invoice_id, amount, payment_date, payment_method
   - Returns: Updated invoice
   - Use Cases: Sync payments from Stripe, bank feeds, manual entry

**Medium Priority Actions (Phase 2):**

6. **Create Quote**
   - Endpoint: `POST /api/quotes`
   - Required: organization_id, client_id, title
   - Returns: Created quote
   - Use Cases: Automated quoting workflows

7. **Update Job Status**
   - Endpoint: `PUT /api/jobs/[id]`
   - Required: job_id, status
   - Returns: Updated job
   - Use Cases: Workflow automation based on external triggers

8. **Add Time Log to Job**
   - Endpoint: `POST /api/jobs/[id]/time-logs`
   - Required: job_id, start_time, end_time, user_id
   - Returns: Created time log
   - Use Cases: Import from time tracking apps (Toggl, Harvest)

9. **Add Expense**
   - Endpoint: `POST /api/expenses`
   - Required: organization_id, user_id, amount, category
   - Returns: Created expense
   - Use Cases: Import from receipt scanning apps

10. **Send SMS**
    - Endpoint: `POST /api/sms/send`
    - Required: organization_id, recipient_phone, message_body
    - Returns: SMS status, credits used
    - Use Cases: Custom notification workflows

#### Search Endpoints (Find Existing Data)

1. **Find Client by Email**
   - Endpoint: `GET /api/clients/search?email=[email]`
   - Returns: Client object or null
   - Use Cases: Dedupe before creating, link to existing

2. **Find Client by Phone**
   - Endpoint: `GET /api/clients/search?phone=[phone]`
   - Returns: Client object or null
   - Use Cases: Phone-based lookups, SMS integrations

3. **Find Job by Job Number**
   - Endpoint: `GET /api/jobs/search?job_number=[number]`
   - Returns: Job object or null
   - Use Cases: Reference existing jobs in workflows

4. **Find Invoice by Invoice Number**
   - Endpoint: `GET /api/invoices/search?invoice_number=[number]`
   - Returns: Invoice object or null
   - Use Cases: Payment reconciliation

#### Technical Implementation

**New API Endpoints Required:**

```
POST   /api/zapier/auth/verify
  - Verify API key validity
  - Return organization details and permissions

POST   /api/zapier/hooks/subscribe
  - Create webhook subscription
  - Parameters: event_type, target_url, filters (optional)
  - Return: subscription_id, hook_url

DELETE /api/zapier/hooks/unsubscribe/:subscription_id
  - Remove webhook subscription
  - Zapier calls this when user turns off Zap

GET    /api/zapier/hooks/poll/:event_type
  - Fallback polling endpoint for testing
  - Returns recent events (last 100)

GET    /api/clients/search
  - Query params: email, phone, name
  - Returns matching clients

GET    /api/jobs/search
  - Query params: job_number, client_id, status
  - Returns matching jobs

GET    /api/invoices/search
  - Query params: invoice_number, client_id, status
  - Returns matching invoices
```

**Webhook Trigger System:**

After key database operations, emit webhooks to subscribed Zapier URLs:

```typescript
// lib/zapier/webhooks.ts
export async function triggerZapierWebhook(params: {
  organization_id: string
  event_type: string
  payload: any
}) {
  // Find active subscriptions
  const subscriptions = await sql`
    SELECT * FROM zapier_subscriptions
    WHERE organization_id = ${params.organization_id}
    AND event_type = ${params.event_type}
    AND is_active = true
  `

  // Send webhook to each subscription (async)
  for (const sub of subscriptions) {
    // Apply filters if any
    if (sub.filters && !matchesFilters(params.payload, sub.filters)) {
      continue
    }

    // Send webhook (with retry logic)
    await sendWebhookWithRetry(sub.target_url, params.payload, sub.id)
  }
}
```

**API Key Authentication:**

```typescript
// middleware/zapier-auth.ts
export async function verifyZapierApiKey(apiKey: string) {
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const keys = await sql`
    SELECT zak.*, o.id as org_id, o.name as org_name
    FROM zapier_api_keys zak
    JOIN organizations o ON zak.organization_id = o.id
    WHERE zak.api_key = ${hash}
    AND zak.is_active = true
    AND (zak.expires_at IS NULL OR zak.expires_at > NOW())
  `

  if (keys.length === 0) return null

  // Update last used
  await sql`UPDATE zapier_api_keys SET last_used_at = NOW() WHERE id = ${keys[0].id}`

  return {
    organization_id: keys[0].organization_id,
    organization_name: keys[0].org_name
  }
}
```

**Zapier Platform App Structure:**

```
zapier-tradie-app/
├── package.json
├── index.js                 # Main entry point
├── authentication.js        # API key auth
├── triggers/
│   ├── new_job.js
│   ├── invoice_paid.js
│   ├── new_client.js
│   ├── job_completed.js
│   └── quote_accepted.js
├── creates/
│   ├── create_client.js
│   ├── create_job.js
│   ├── create_invoice.js
│   ├── send_invoice.js
│   └── record_payment.js
├── searches/
│   ├── find_client.js
│   ├── find_job.js
│   └── find_invoice.js
└── test/
    └── triggers.test.js
```

#### Workflow Examples

**Example 1: New Job → Google Calendar Event**
1. Trigger: New Job Created
2. Filter: Only scheduled jobs
3. Action: Create Google Calendar event with job details, client address, assigned team member

**Example 2: Invoice Paid → QuickBooks Payment**
1. Trigger: Invoice Paid
2. Search: Find QuickBooks invoice by invoice_number
3. Action: Record payment in QuickBooks

**Example 3: Form Submission → New Job**
1. Trigger: Typeform submission
2. Search: Find client by email (or create if not exists)
3. Action: Create job with details from form

**Example 4: Time Tracked → Spreadsheet Update**
1. Trigger: Time Log Submitted
2. Action: Add row to Google Sheets with hours, job, date

**Example 5: Overdue Invoice → SMS Reminder**
1. Trigger: Invoice Overdue
2. Filter: >7 days overdue
3. Action: Send SMS via Twilio with payment link

#### Mobile UI (API Key Management)

**Settings → Integrations → Zapier:**
- "Connect to Zapier" button
- Shows: "Zapier lets you connect to 6,000+ apps"
- Click → Shows API key generation screen

**API Key Generation:**
- "Generate New API Key" button
- Form:
  - Key name (e.g., "Main Automation")
  - Expiry (never, 30 days, 90 days, 1 year)
- Generate → Display key ONCE with copy button
- Warning: "Save this key now. You won't be able to see it again."

**API Key List:**
- Shows active keys with:
  - Name
  - Prefix (zap_abc123...)
  - Created date
  - Last used
  - Expires
  - Revoke button

**Active Zaps Dashboard:**
- List of webhook subscriptions
- Shows: Event type, target URL (truncated), created date
- Can deactivate (but user manages in Zapier)

**Webhook Activity Log:**
- Last 100 webhook deliveries
- Shows: Event, status (success/failed), timestamp
- Filter by: success, failed, event type
- For debugging connection issues

#### Implementation Phases

### Phase 1: Core Infrastructure (3 weeks)

**Week 1: Database & Authentication**
- Create database migrations for 3 new tables
- Implement API key generation utility
- Build API key authentication middleware
- Create `/api/zapier/auth/verify` endpoint
- Testing: API key lifecycle

**Week 2: Webhook Subscription System**
- Build `/api/zapier/hooks/subscribe` endpoint
- Build `/api/zapier/hooks/unsubscribe/:id` endpoint
- Create webhook trigger utility function
- Implement retry logic with exponential backoff
- Testing: Subscription CRUD

**Week 3: High-Priority Triggers (5 triggers)**
- Implement webhook calls for:
  - job.created (after POST /api/jobs)
  - invoice.paid (after payment recorded)
  - client.created (after POST /api/clients)
  - job.completed (after status change)
  - quote.accepted (after acceptance)
- Build polling fallback endpoints
- Testing: End-to-end trigger delivery

---

### Phase 2: Zapier Platform App (2 weeks)

**Week 4: Zapier App Development**
- Set up Zapier Platform CLI project
- Configure API key authentication
- Implement 5 core triggers with REST Hooks
- Implement 5 core actions
- Implement 3 core searches
- Local testing with `zapier test`

**Week 5: Beta Testing & Polish**
- Deploy to Zapier private beta
- Test with 5 real Zaps from different use cases
- Create pre-built Zap templates
- Error handling improvements
- User documentation
- Submit for Zapier review

---

### Phase 3: Extended Features (2 weeks)

**Week 6: Additional Triggers & Actions**
- Add 5 more triggers (quote.sent, expense.submitted, etc.)
- Add 5 more actions (create quote, update job, add expense, etc.)
- Enhanced search capabilities
- Filtering support for triggers
- Testing: Extended coverage

**Week 7: Launch & Marketing**
- Public launch in Zapier App Directory
- Create 10 pre-built Zap templates
- Record 5 tutorial videos
- Blog post with use cases
- Email announcement to users
- Monitor adoption and feedback

---

## MVP Scope (Launch in 3-4 weeks)

**Minimum Viable Integration:**

**Triggers (5):**
1. New Job Created
2. Invoice Paid
3. New Client Created
4. Job Completed
5. Quote Accepted

**Actions (5):**
1. Create Client
2. Create Job
3. Create Invoice
4. Send Invoice via Email
5. Record Invoice Payment

**Searches (3):**
1. Find Client by Email
2. Find Job by Job Number
3. Find Invoice by Invoice Number

**Authentication:** API Keys (OAuth 2.0 in Phase 4)

**Estimated Effort:** 3-4 weeks (1 developer) or 2 weeks (2 developers in parallel)

---

## Success Metrics

**Adoption Metrics:**
- 20%+ of active organizations enable Zapier integration within 3 months
- Average 3+ Zaps created per organization
- 50%+ of Zaps still active after 30 days

**Technical Metrics:**
- Webhook delivery success rate: >99%
- API response time: <500ms (P95)
- API error rate: <1%
- Zero data leaks between organizations

**User Satisfaction:**
- NPS score >50 for Zapier integration
- <5% support ticket rate related to integration
- App Store reviews mentioning Zapier automation

**Business Impact:**
- Reduces churn by 15% among power users
- Increases feature adoption (users create more jobs/invoices)
- Positive differentiator in sales process

---

## Popular Use Cases (Top 20)

1. **New job → Google Calendar** - Auto-create calendar events
2. **Invoice paid → QuickBooks** - Sync payments to accounting
3. **New client → HubSpot** - Add to CRM automatically
4. **Job completed → Email** - Send review request
5. **Quote accepted → Slack** - Notify sales team
6. **Expense submitted → Approve via Slack** - Approval workflow
7. **New job → Trello card** - Project management
8. **Invoice sent → Follow-up email** - 3 days later if unpaid
9. **Client created → Mailchimp** - Add to email list
10. **Payment received → Thank you email** - Customer appreciation
11. **Typeform submission → New job** - Website form integration
12. **Time logged → Google Sheets** - Payroll tracking
13. **Overdue invoice → SMS reminder** - Via Twilio
14. **New job → Monday.com** - Project board
15. **Quote sent → Airtable** - Sales pipeline tracking
16. **Job completed → Generate PDF report** - Via DocuPilot
17. **SMS received → Create ticket** - Support system
18. **Invoice created → Dropbox** - Backup PDFs
19. **New appointment → SMS reminder** - Day before
20. **Material added → Inventory update** - Stock management

---

## Open Questions

1. **Recurring Job Automation:**
   - Should clients be able to manage their recurring services (pause, cancel) via a client portal?
   - How to handle pricing changes for recurring services (lock in price vs. notify of increase)?

2. **Completion Forms:**
   - Should clients be required to sign completion forms, or optional?
   - Store completion forms indefinitely or expire after X years?

3. **Online Job Request Forms:**
   - Allow anonymous requests (no email required) with SMS-only contact?
   - Integrate with website chat (e.g., "Start a request from this chat")?

4. **Notifications:**
   - Push notification daily limit per user (avoid spam)?
   - Escalation rules (if notification not acted on, escalate to manager)?

5. **Zapier Integration:**
   - Should Zapier be free tier or premium feature?
   - Limit number of Zaps or API calls for free tier?
   - Offer OAuth 2.0 authentication in addition to API keys?
   - Support incoming webhooks (not just outgoing)?

6. **All Features:**
   - Which feature should be prioritized first based on user feedback?
   - Should any features be premium/paid-only, or all included in free tier?

---

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


