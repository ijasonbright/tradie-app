# Feature Roadmap: Notifications, Automation & Customer Features

## Overview
This document outlines the upcoming features for the Tradie App, focusing on intelligent notifications, workflow automation, professional completion reports, and customer-facing features.

---

## 1. Intelligent Notifications System

### A. Job & Appointment Notifications

#### 1.1 Upcoming Appointments
**Trigger:** Appointment scheduled for tomorrow or today
**Recipients:** Assigned team member(s), Client
**Channels:** Push notification (mobile), SMS (optional), Email
**Content:**
- Team: "Tomorrow 9:00 AM: Site visit for John Doe at 123 Main St"
- Client: "Reminder: We'll be visiting tomorrow at 9:00 AM"
**Settings:** Configurable timing (24hrs, 12hrs, 2hrs before)

#### 1.2 Job Completion Pending Invoice
**Trigger:** Job status = 'completed' but no invoice created after 24 hours
**Recipients:** Owner, Admin, Assigned team member
**Channels:** Push notification, Email daily digest
**Content:** "Job JOB-2025-001 completed 2 days ago - No invoice created yet"
**Smart Logic:** Group multiple jobs in daily digest to avoid spam

#### 1.3 Overdue Appointments
**Trigger:** Appointment start time passed but not marked complete
**Recipients:** Assigned team member, Admin
**Channels:** Push notification
**Content:** "Appointment at 123 Main St overdue - Update status?"
**Action Buttons:** Mark Complete | Reschedule | Cancel

### B. Financial Notifications

#### 2.1 Overdue Invoices (Internal Alert)
**Trigger:** Invoice overdue by X days (configurable: 7, 14, 30 days)
**Recipients:** Owner, Admin
**Channels:** Push notification, Email digest
**Content:** "3 invoices overdue: INV-001 ($500, 14 days), INV-002 ($1,200, 7 days)..."
**Smart Actions:**
- "Call Client" - Opens phone dialer with client number
- "Send Reminder" - Quick send reminder SMS/Email
- "View Invoice" - Deep link to invoice detail

#### 2.2 Payment Received
**Trigger:** Payment recorded on invoice
**Recipients:** Owner, Admin, Team member who created invoice
**Channels:** Push notification
**Content:** "Payment received: $500.00 for INV-2025-001 from John Doe"

#### 2.3 Low SMS Credits
**Trigger:** SMS credits < threshold (default 20)
**Recipients:** Owner, Admin
**Channels:** Push notification, Email
**Content:** "SMS credits running low: 15 credits remaining ($0.75)"
**Action Button:** Buy Credits

#### 2.4 Large Invoice Created
**Trigger:** Invoice created with amount > $X (configurable, default $5,000)
**Recipients:** Owner
**Channels:** Email
**Content:** "High-value invoice created: INV-2025-001 for $8,500.00 - John Doe"
**Purpose:** Fraud prevention, quality control

### C. Compliance & License Expiry Notifications

#### 3.1 Document Expiry Warnings
**Trigger:** Document expires in 30 days, 14 days, 7 days, tomorrow
**Recipients:**
- Organization docs: Owner, Admin
- User docs: The user, Owner, Admin
**Channels:** Push notification, Email, SMS (for critical)
**Content Examples:**
- "Company Insurance expires in 30 days - Renew now to avoid lapses"
- "John's Electrical License expires in 7 days"
- "⚠️ URGENT: Your White Card expires TOMORROW"
**Action Buttons:** Upload Renewed Document | Extend Expiry Date | Dismiss

#### 3.2 Expired Document Alerts
**Trigger:** Document expires today or is expired
**Recipients:** Owner, Admin, The user (if personal doc)
**Channels:** Push notification (urgent), Email
**Content:** "🚨 EXPIRED: Company Public Liability Insurance - Cannot work legally"
**Action:** Upload New Document
**Smart Block:** Optionally prevent job assignment to users with expired licenses

#### 3.3 Missing Required Documents
**Trigger:** User added to organization without required docs
**Recipients:** Owner, Admin, The user
**Channels:** Email, Push notification
**Content:** "Action Required: Upload your Trade License and Insurance to start working"
**Checklist:** Display required documents with upload buttons

### D. Team & Workload Notifications

#### 4.1 Unassigned Jobs
**Trigger:** Job created but no one assigned after 2 hours
**Recipients:** Owner, Admin
**Channels:** Push notification
**Content:** "Job JOB-2025-001 created 2 hours ago - No team member assigned"
**Action Button:** Assign Now

#### 4.2 Overloaded Team Member
**Trigger:** Team member has >5 active jobs or >40 hours scheduled this week
**Recipients:** Owner, Admin
**Channels:** Email digest (daily)
**Content:** "John has 7 active jobs this week (45 hours scheduled) - Consider rebalancing"
**Smart Suggestion:** Show team members with lighter workload

#### 4.3 Idle Team Member
**Trigger:** Team member has 0 jobs assigned for next 3 days
**Recipients:** Owner, Admin
**Channels:** Email digest
**Content:** "Mike has no jobs scheduled for the next 3 days"
**Purpose:** Resource optimization

### E. Customer Communication Notifications

#### 5.1 New SMS Message Received
**Trigger:** Inbound SMS from client
**Recipients:** Owner, Admin, Team member assigned to client's active job
**Channels:** Push notification (immediate)
**Content:** "New message from John Doe: 'Running 10 mins late'"
**Action:** Reply directly from notification

#### 5.2 Quote Viewed by Client
**Trigger:** Client opens quote link (when public quotes implemented)
**Recipients:** Quote creator, Owner
**Channels:** Push notification
**Content:** "John Doe viewed Quote QTE-2025-001 ($2,500)"
**Smart Timing:** Send follow-up suggestion after 48 hours if not accepted

#### 5.3 Quote Expiring Soon
**Trigger:** Quote expires in 3 days, 1 day
**Recipients:** Quote creator, Owner
**Channels:** Push notification, Email
**Content:** "Quote QTE-2025-001 expires in 3 days - Follow up with John Doe?"
**Action Buttons:** Extend Validity | Convert to Job | Send Reminder

---

## 2. Cyclical Job Automation

### 2.1 Recurring Service Scheduler

**Purpose:** Automate reminders for regular maintenance jobs (pool cleaning, HVAC servicing, garden maintenance, etc.)

#### Database Schema Addition:
```sql
CREATE TABLE recurring_job_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),
  template_name VARCHAR(255), -- e.g., "Quarterly AC Service"
  job_type VARCHAR(100),
  description TEXT,
  frequency VARCHAR(50), -- weekly, monthly, quarterly, yearly, custom
  frequency_value INTEGER, -- For custom: e.g., every X days
  next_scheduled_date DATE,
  auto_create_job BOOLEAN DEFAULT false, -- Auto-create job or just remind
  require_client_approval BOOLEAN DEFAULT false,
  quoted_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recurring_job_history (
  id UUID PRIMARY KEY,
  recurring_template_id UUID REFERENCES recurring_job_templates(id),
  job_id UUID REFERENCES jobs(id),
  scheduled_date DATE,
  client_approved_at TIMESTAMP,
  client_declined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Features:

**2.1.1 Create Recurring Service Template**
- Link to existing client
- Set frequency: Weekly, Monthly, Quarterly, Yearly, Custom (every X days)
- Option to auto-create job or send approval request to client
- Set default pricing

**2.1.2 Client Approval Workflow (Optional)**
- 7 days before next scheduled date, send SMS/Email to client
- Message: "Hi John, your quarterly AC service is due on 20 Jan. Tap to confirm: [Yes, book it] [Not now]"
- Unique approval link with simple form
- If approved: Auto-create job and send confirmation
- If declined: Skip this cycle, ask reason (optional), reschedule for next cycle

**2.1.3 Auto-Create Without Approval**
- Automatically create job X days before scheduled date
- Assign to default team member or leave unassigned
- Send notification to team and client
- Job appears in schedule as "Recurring Service"

**2.1.4 Smart Scheduling**
- Suggest next available date based on team member availability
- Avoid double-booking
- Consider previous job completion time and adjust future schedules

**2.1.5 Recurring Service Dashboard**
- View all recurring services
- See upcoming scheduled dates
- Track completion rate per client
- Pause/Resume/Cancel recurring services
- Bulk operations: "Send approval requests for all due this month"

#### Mobile App UI:
- "Recurring Services" tab in Client detail view
- "+" button to create new recurring service
- List shows: Frequency, Next scheduled date, Status, Last completed
- Badge notification for pending client approvals

---

## 3. Job Completion Forms & PDF Reports

### 3.1 Customizable Completion Forms

#### Database Schema Addition:
```sql
CREATE TABLE job_completion_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  template_name VARCHAR(255),
  job_type VARCHAR(100), -- Link to specific job types
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_completion_fields (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES job_completion_templates(id),
  field_type VARCHAR(50), -- text, textarea, checkbox, signature, photo, rating
  field_label VARCHAR(255),
  field_required BOOLEAN DEFAULT false,
  field_order INTEGER,
  field_options JSONB, -- For dropdowns, checkboxes
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_completion_responses (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  field_id UUID REFERENCES job_completion_fields(id),
  response_value TEXT,
  response_file_url TEXT, -- For photos/signatures
  completed_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Features:

**3.1.1 Template Builder (Web Dashboard)**
- Create completion form templates per job type
- Drag-and-drop field builder
- Field types:
  - **Text Input:** Short answer (e.g., "Meter reading")
  - **Long Text:** Notes (e.g., "Additional work required")
  - **Checkbox List:** Pre-defined checklist (e.g., "Tools removed", "Site cleaned", "Safety checks done")
  - **Signature:** Client signature pad
  - **Photo Upload:** Before/after photos
  - **Rating:** Star rating (e.g., "Customer satisfaction")
  - **Dropdown:** Select options (e.g., "Condition: Excellent/Good/Fair/Poor")
  - **Yes/No:** Boolean questions
- Mark fields as required
- Preview form
- Assign template to job types

**3.1.2 Mobile Completion Form**
- When marking job as complete, show completion form
- Prefill job details (job number, client, date, time)
- Step-by-step form with validation
- Camera integration for photo fields
- Signature capture with smooth drawing
- Save as draft if interrupted
- Submit when all required fields complete

**3.1.3 Client Signature & Approval**
- Optional: Hand mobile to client for signature
- Client signs on screen
- Add client name and date automatically
- "I confirm the work was completed satisfactorily" text above signature
- Store signature as image file

**3.1.4 Pre-defined Templates**
Ship with templates for common trades:
- **Electrical:** Safety tests done, Circuit tested, Compliance certificate issued, Customer signature
- **Plumbing:** Water pressure tested, Leaks checked, System flushed, Site cleaned
- **HVAC:** System performance, Filter condition, Refrigerant levels, Client walkthrough done
- **General:** Before photos, After photos, Work completed checklist, Client signature, Issues found

### 3.2 Professional PDF Report Generation

#### Features:

**3.2.1 PDF Report Structure**
- **Header:**
  - Company logo
  - Company name, ABN, contact details
  - "Job Completion Report" title
  - Job number, Date completed
- **Job Details Section:**
  - Client name and address
  - Job type and description
  - Scheduled date vs Actual completion date
  - Team members who worked on job
  - Total time spent
- **Work Completed Section:**
  - Itemized list of tasks from completion form
  - Checklist items with ✓/✗ indicators
  - Notes and observations
- **Photos Section:**
  - Before/After photo grid
  - Captions for each photo
  - Issue photos with descriptions
- **Materials Used:** (if tracked)
  - List of materials from job_materials table
  - Quantities and descriptions
- **Client Approval:**
  - Signature image
  - Client name
  - Date signed
- **Footer:**
  - "Thank you for your business"
  - Company tagline or warranty info
  - Invoice details if attached

**3.2.2 PDF Generation Trigger**
- Auto-generate when job marked complete with form submitted
- Store PDF in Vercel Blob Storage
- Link to job record

**3.2.3 PDF Delivery**
- Attach to invoice when sent
- Email separately: "Job Completion Report for [Job Title]"
- SMS link (costs 1 credit): "Your job report is ready: [shortlink]"
- Available in customer portal (future feature)
- Download in mobile app and web dashboard

**3.2.4 PDF Branding**
- Use organization's logo and colors
- Customizable footer text
- Professional template with clean layout
- Mobile-friendly viewing

#### Technical Implementation:
- Use `pdf-lib` (already in dependencies) or `puppeteer` for generation
- Generate HTML template with Tailwind CSS
- Convert to PDF
- Compress images for smaller file size
- Store filename: `job-completion-[job-number]-[date].pdf`

---

## 4. Online Job Request Form (Customer Portal)

### 4.1 Embeddable Web Form

#### Database Schema Addition:
```sql
CREATE TABLE job_request_forms (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  form_name VARCHAR(255),
  form_slug VARCHAR(255) UNIQUE, -- URL-friendly: company-slug-form-name
  is_active BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT true,
  confirmation_message TEXT,
  redirect_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_request_form_fields (
  id UUID PRIMARY KEY,
  form_id UUID REFERENCES job_request_forms(id),
  field_type VARCHAR(50), -- text, email, phone, textarea, dropdown, checkbox, file, address
  field_label VARCHAR(255),
  field_placeholder VARCHAR(255),
  field_required BOOLEAN DEFAULT false,
  field_order INTEGER,
  field_options JSONB, -- For dropdowns
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_request_form_presets (
  id UUID PRIMARY KEY,
  form_id UUID REFERENCES job_request_forms(id),
  preset_name VARCHAR(255), -- e.g., "Emergency Callout", "Standard Service"
  job_type VARCHAR(100),
  preset_price DECIMAL(10,2),
  require_deposit BOOLEAN DEFAULT false,
  deposit_type VARCHAR(20), -- percentage, fixed
  deposit_amount DECIMAL(10,2),
  preset_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_requests (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  form_id UUID REFERENCES job_request_forms(id),
  preset_id UUID REFERENCES job_request_form_presets(id),
  request_data JSONB, -- All form responses
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  client_address TEXT,
  status VARCHAR(50), -- pending, approved, rejected, converted_to_job
  deposit_paid BOOLEAN DEFAULT false,
  deposit_amount DECIMAL(10,2),
  stripe_payment_intent_id VARCHAR(255),
  converted_to_job_id UUID REFERENCES jobs(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Features:

**4.1.1 Form Builder (Web Dashboard)**
- Create custom forms for website embedding
- Form settings:
  - Form name (internal)
  - URL slug (public facing): `mycompany-emergency-service`
  - Active/Inactive toggle
  - Require admin approval before creating job
  - Custom confirmation message
  - Redirect URL after submission (optional)
- **Compulsory Fields (always included):**
  - Full name *
  - Email address *
  - Phone number *
  - Service address *
  - Describe the issue * (textarea)
- **Optional Custom Fields:**
  - Add any additional fields:
    - Preferred date/time
    - Property type (Residential/Commercial)
    - Urgency level
    - Photo upload (issue photos)
    - How did you hear about us?
  - Drag to reorder
  - Mark as required
- **Service Presets (Optional):**
  - Define pre-priced services
  - Example: "Emergency Callout - $150 + $80/hr after first hour"
  - Each preset can have:
    - Service name
    - Description
    - Fixed price or quote required
    - Deposit required (Yes/No)
    - Deposit amount (percentage or fixed)
  - Customer selects from dropdown or radio buttons

**4.1.2 Public Form Page**
- Clean, professional form hosted at:
  - `https://your-app.com/request-job/[slug]`
  - Or custom domain: `https://bookings.yourcompany.com/[slug]`
- Mobile-responsive design
- Shows company logo and name
- Trust indicators: "Secure", "Encrypted", badges
- Real-time field validation
- reCAPTCHA to prevent spam
- Progress indicator if multi-step
- "Submit Request" button

**4.1.3 Payment Integration (for presets with deposits)**
- If service preset requires deposit:
  - After form submission, redirect to Stripe Checkout
  - Charge deposit amount
  - On successful payment, mark request as paid
  - Send receipt to customer
  - Create job immediately (or pending approval)
- Payment confirmation: "Deposit of $50 received. We'll contact you within 2 hours."

**4.1.4 Form Submission Workflow**

**Option A: Requires Approval (Default)**
1. Customer submits form
2. Request saved with status = 'pending'
3. Notification sent to Owner/Admin: "New job request from Sarah Smith - Emergency Plumbing"
4. Owner reviews in dashboard
5. Actions available:
   - **Approve & Create Job:** Converts to job, assigns team member, sends confirmation
   - **Request More Info:** Send email/SMS asking for clarification
   - **Reject:** Send polite decline message with reason
   - **Create Quote:** Convert to quote instead of job
6. Customer receives email: "Your request has been approved. Job #JOB-2025-050 created."

**Option B: Auto-Create Job**
1. Customer submits form (and pays deposit if required)
2. Job automatically created with status = 'quoted' or 'scheduled'
3. Notification sent to team: "New job created from website: Sarah Smith - 123 Main St"
4. Customer receives immediate confirmation email with job number
5. Admin can still review and modify job

**4.1.5 Email/SMS Confirmations**
- **To Customer (immediate):**
  - "Thank you for your request!"
  - Request ID or Job Number
  - What happens next
  - Estimated response time
  - Contact details if urgent
- **To Organization:**
  - Push notification (urgent icon if marked as emergency)
  - Email with all details
  - Link to review request
  - Customer contact details prominent

**4.1.6 Form Embed Code**
- Generate iframe embed code:
  ```html
  <iframe src="https://your-app.com/request-job/mycompany-service"
          width="100%"
          height="800px"
          frameborder="0">
  </iframe>
  ```
- Or JavaScript widget for seamless integration
- Preview how form looks on customer's website

**4.1.7 Form Analytics**
- Track submissions per form
- Conversion rate (submitted → job created)
- Average response time
- Popular service presets
- Abandonment rate (started but not submitted)

**4.1.8 Anti-Spam Measures**
- reCAPTCHA v3 (invisible)
- Rate limiting: Max 3 submissions per IP per hour
- Email verification optional
- Flag suspicious submissions for review

---

## 5. Notification Settings & Preferences

### 5.1 User Notification Preferences

#### Allow each user to customize:
- **Push Notifications:** On/Off per category
  - Jobs assigned to me
  - Job updates
  - Appointments
  - Messages
  - Payments received
  - Urgent alerts (always on)
- **Email Notifications:**
  - Daily digest
  - Weekly summary
  - Immediate for urgent only
- **SMS Notifications:** (Costs organization)
  - Emergency/Urgent only
  - Never
- **Quiet Hours:**
  - Don't send notifications between 8 PM - 7 AM
  - Except emergencies

### 5.2 Organization Notification Settings

#### Global Settings:
- Enable/Disable categories
- Set thresholds:
  - Overdue invoice after X days
  - Completion pending invoice after X hours
  - Document expiry warning at X days
- Notification recipients per category
- Email templates customization
- SMS notification costs opt-in

---

## Implementation Priority & Phases

### Phase 1: Critical Notifications (2 weeks)
1. ✅ Invoice reminders (DONE)
2. ⬜ Document expiry warnings
3. ⬜ Appointment reminders
4. ⬜ Job completion pending invoice
5. ⬜ Payment received notifications

### Phase 2: Job Completion Forms (3 weeks)
1. ⬜ Database schema
2. ⬜ Template builder (web)
3. ⬜ Mobile completion form
4. ⬜ PDF report generation
5. ⬜ Auto-attach to invoices

### Phase 3: Online Job Request Form (2 weeks)
1. ⬜ Database schema
2. ⬜ Form builder (web)
3. ⬜ Public form page
4. ⬜ Payment integration
5. ⬜ Embed code generator
6. ⬜ Spam prevention

### Phase 4: Recurring Jobs (2 weeks)
1. ⬜ Database schema
2. ⬜ Recurring template creation
3. ⬜ Client approval workflow
4. ⬜ Auto-job creation
5. ⬜ Scheduling dashboard

### Phase 5: Advanced Notifications (1 week)
1. ⬜ Overdue invoice alerts
2. ⬜ Overloaded/Idle team member
3. ⬜ Quote expiry
4. ⬜ SMS received
5. ⬜ Notification preferences UI

### Phase 6: Notification System Infrastructure (1 week)
1. ⬜ Notification queue system
2. ⬜ Push notification service (Expo Notifications)
3. ⬜ Email templates
4. ⬜ Batching/Digest system
5. ⬜ User preferences storage

---

## Technical Requirements

### Push Notifications:
- **Service:** Expo Notifications API
- **Setup:** Configure APNs (iOS) and FCM (Android)
- **Storage:** Store device tokens per user
- **Delivery:** Queue-based for reliability

### Email Service:
- **Current:** Resend or SendGrid (from CLAUDE.md)
- **Templates:** HTML email templates with variables
- **Batching:** Daily digest system to avoid spam

### PDF Generation:
- **Library:** `pdf-lib` (already installed) or `puppeteer`
- **Storage:** Vercel Blob Storage
- **Compression:** Optimize images before embedding

### Cron Jobs:
- **Service:** Vercel Cron (already in vercel.json)
- **Frequency:**
  - Document expiry check: Daily at 6 AM
  - Recurring job scheduler: Daily at 7 AM
  - Overdue invoice alerts: Daily at 9 AM
  - Team workload digest: Daily at 5 PM

### Queue System (Future):
- **Service:** Upstash Redis or Inngest
- **Purpose:** Reliable notification delivery
- **Retry:** Failed notifications retry 3x with backoff

---

## Additional Feature Ideas (For Discussion)

1. **Customer Satisfaction Surveys:**
   - Send SMS/Email after job completion
   - Simple 5-star rating + optional comment
   - Display ratings in reports

2. **Automatic Follow-ups:**
   - "How's everything working?" 7 days after job completion
   - "We haven't heard from you in 6 months - Need any servicing?"

3. **Predictive Maintenance Reminders:**
   - Based on manufacturer recommendations
   - "Your AC should be serviced every 6 months - Last service was 5 months ago"

4. **Smart Job Scheduling Suggestions:**
   - "Mike is free tomorrow 2-4 PM and lives near this job - Assign?"
   - Route optimization for multiple jobs same day

5. **Client Portal Login:**
   - Customers can log in to see job history
   - Download invoices and completion reports
   - Request new services

6. **Automated Thank You Messages:**
   - Send after payment received
   - Branded message with review request

7. **Reputation Management:**
   - Automated Google/Facebook review requests
   - Monitor reviews dashboard
   - Respond to reviews from app

---

## Questions for Clarification

1. **Notification Preferences:** Should users be able to completely disable certain notifications, or should some (like license expiry) be mandatory?

2. **Job Completion PDF:** Should the PDF be sent automatically with the invoice, or as a separate email?

3. **Online Form:** Should there be a single form per organization, or allow multiple forms (e.g., one for emergency, one for quotes)?

4. **Recurring Jobs:** Should clients be able to manage their recurring services themselves (pause/cancel) via a portal?

5. **Payment for Online Form:** Require Stripe account for deposit feature, or make it optional?

6. **Document Expiry:** Should the system prevent job assignment to users with expired critical licenses (e.g., trade license)?

7. **Completion Form Templates:** Should there be industry-specific default templates, or expect users to build from scratch?

---

## Success Metrics

- **Notification Engagement:** >60% open rate for push notifications
- **Job Completion Forms:** >80% adoption rate by active users
- **Online Form Submissions:** Track conversion rate (submission → job)
- **Recurring Jobs:** Track retention rate for cyclical services
- **Document Compliance:** 0 expired critical licenses for active users
- **Response Time:** Avg. time from job request to response <2 hours

---

*This roadmap is a living document and will be updated as features are implemented and refined based on user feedback.*
