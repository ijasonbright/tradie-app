# Comprehensive Rates & Trades System Plan

## Architecture Overview

### The Problem with Current System:
- Single default hourly rate doesn't account for different trades
- No separation between what employee enters vs admin manages
- Can't track costs per trade type
- Missing daily rate vs hourly rate options

### New System Design:

## 1. Database Schema Changes

### A. Trade Types Table (New)
```sql
CREATE TABLE trade_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name VARCHAR(100) NOT NULL, -- e.g., "Plumbing", "Electrical", "HVAC"
  client_hourly_rate DECIMAL(10, 2) NOT NULL, -- What you charge clients per hour
  client_daily_rate DECIMAL(10, 2), -- Optional daily rate
  default_employee_cost DECIMAL(10, 2), -- Default cost for employees of this trade
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, name)
);
```

### B. Update Organization Members
```sql
-- Add to organization_members table:
ALTER TABLE organization_members
ADD COLUMN primary_trade_id UUID REFERENCES trade_types(id),
ADD COLUMN rate_type VARCHAR(20) DEFAULT 'hourly', -- 'hourly' or 'daily'
ADD COLUMN daily_rate DECIMAL(10, 2), -- For subcontractors who charge per day
-- Rename for clarity:
ALTER TABLE organization_members RENAME COLUMN hourly_rate TO cost_rate;
ALTER TABLE organization_members RENAME COLUMN billing_rate TO override_billing_rate;

COMMENT ON COLUMN organization_members.cost_rate IS 'What the organization pays this person (hourly or daily based on rate_type)';
COMMENT ON COLUMN organization_members.override_billing_rate IS 'Override the trade default rate for billing this person to clients';
```

### C. Jobs Link to Trade
```sql
ALTER TABLE jobs
ADD COLUMN trade_type_id UUID REFERENCES trade_types(id);

COMMENT ON COLUMN jobs.trade_type_id IS 'Which trade type this job requires (determines billing rate)';
```

### D. User Documents Enhancement
```sql
-- Already exists but enhance:
ALTER TABLE user_documents
ADD COLUMN document_category VARCHAR(50), -- 'license', 'insurance', 'certification'
ADD COLUMN verified_by_user_id UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMP,
ADD COLUMN verification_notes TEXT;
```

## 2. User Roles & Permissions

### Employee/Subcontractor View:
**"My Profile" Page** (`/dashboard/profile`)
- Personal Information
  - Full name, email, phone
  - Home address
  - Emergency contact
- Documents (Self-Upload)
  - Licenses (select type + upload photos)
  - Insurance (select type + upload)
  - Certifications
  - Can see expiry warnings
- View Only (Set by Admin):
  - Employment type (Employee/Subcontractor)
  - Primary trade
  - My rate (shows what they earn, not what client is charged)
  - Leave balance (employees only)

### Admin View:
**"Team Management" Page** (`/dashboard/team`)
- List all team members
- Filter by: Active/Inactive, Employee/Subcontractor, Trade Type
- For each member:
  - View/verify documents
  - Set employment details:
    - Primary trade
    - Rate type (hourly/daily)
    - Cost rate (what you pay them)
    - Override billing rate (optional - if different from trade default)
    - Leave balance
    - Availability for scheduling

## 3. Settings Page Structure

### `/dashboard/settings` - Tabbed Interface:

**Tab 1: Business Information**
- Company name, ABN, address, contact
- Banking details
- (Current functionality)

**Tab 2: Trade Types & Rates**
```
┌─────────────────────────────────────────────────────┐
│ Trade Types                               [+ Add]   │
├─────────────────────────────────────────────────────┤
│ Plumbing                                  [Edit]    │
│   Client Rate: $95/hour  |  $760/day              │
│   Default Employee Cost: $55/hour                   │
│   Active: ✓                                         │
├─────────────────────────────────────────────────────┤
│ Electrical                                [Edit]    │
│   Client Rate: $110/hour  |  $880/day             │
│   Default Employee Cost: $65/hour                   │
│   Active: ✓                                         │
├─────────────────────────────────────────────────────┤
│ HVAC                                      [Edit]    │
│   Client Rate: $105/hour  |  $840/day             │
│   Default Employee Cost: $60/hour                   │
│   Active: ✓                                         │
└─────────────────────────────────────────────────────┘
```

**Tab 3: Template Trades** (Optional Future)
- Predefined trades library
- Quick add common trades

## 4. How Rates Work - Examples

### Example 1: Simple Plumbing Job
1. Create job → Select "Plumbing" trade
2. Assign to John (Plumber, $55/hr cost)
3. John logs 5 hours
4. **Cost Calculation:**
   - Labor cost = 5 hrs × $55/hr = $275 (what you paid)
5. **Invoice Calculation:**
   - Invoice line = 5 hrs × $95/hr = $475 (what client pays)
6. **Profit:** $475 - $275 = $200 (72% margin)

### Example 2: Mixed Trade Job (Plumbing + Electrical)
1. Create job → Primary trade: "Plumbing"
2. Can assign multiple people with different trades
3. Time logs track:
   - John (Plumber) - 3 hrs @ $55 cost, bills @ $95
   - Sarah (Electrician) - 2 hrs @ $65 cost, bills @ $110
4. **Invoice shows:**
   - Plumbing labor: 3 hrs @ $95 = $285
   - Electrical labor: 2 hrs @ $110 = $220
   - Total: $505

### Example 3: Subcontractor on Daily Rate
1. Mike (Subbie, daily rate $400/day, bills client @ $760/day)
2. Logs 1 day on job
3. **Cost:** $400
4. **Invoice:** $760
5. **Profit:** $360

## 5. Reporting - Cost vs Revenue by Trade

**Daily Report:**
```
┌────────────────────────────────────────────────────┐
│ Trade Performance - January 20, 2025               │
├────────────────────────────────────────────────────┤
│ Plumbing                                           │
│   Hours Worked: 24                                 │
│   Labor Cost: $1,320                               │
│   Client Billing: $2,280                           │
│   Profit: $960 (72%)                               │
├────────────────────────────────────────────────────┤
│ Electrical                                         │
│   Hours Worked: 16                                 │
│   Labor Cost: $1,040                               │
│   Client Billing: $1,760                           │
│   Profit: $720 (69%)                               │
└────────────────────────────────────────────────────┘
```

## 6. Migration Plan

### Phase 1: Database Updates
1. Create trade_types table
2. Update organization_members with trade fields
3. Add trade_type_id to jobs
4. Migrate existing data:
   - Create "General" trade from org default rates
   - Link all existing members to "General"

### Phase 2: Settings UI
1. Build trade types management
2. Add/edit/deactivate trades
3. Set rates per trade

### Phase 3: Team Management
1. Build team list page
2. Build member profile (self-service)
3. Build admin member management
4. Document upload/verification system

### Phase 4: Job Updates
1. Add trade selection to job creation
2. Update time log billing to use trade rates
3. Update invoice generation

### Phase 5: Reporting
1. Trade performance reports
2. Cost vs revenue analysis
3. Profitability by trade

## 7. Implementation Priority

**Week 1:**
- ✓ Navigation updates (Settings/Team links)
- Create trade_types table
- Build trade management UI in settings
- Migration script

**Week 2:**
- Team member list page
- Member profile (self-service) page
- Admin member edit page
- Document upload system

**Week 3:**
- Update job creation with trade selection
- Update time log calculations
- Update invoice generation
- Testing

**Week 4:**
- Reporting dashboard
- Trade performance metrics
- Polish & refinements
