-- Add appointments table for calendar/scheduling
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "title" varchar(255) NOT NULL,
  "description" text,
  "appointment_type" varchar(50) NOT NULL,
  "start_time" timestamp NOT NULL,
  "end_time" timestamp NOT NULL,
  "all_day" boolean DEFAULT false,
  "job_id" uuid REFERENCES "jobs"("id"),
  "client_id" uuid REFERENCES "clients"("id"),
  "assigned_to_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "location_address" text,
  "reminder_minutes_before" varchar(50),
  "reminder_sent_at" timestamp,
  "is_recurring" boolean DEFAULT false,
  "recurrence_rule" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add expenses table
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "job_id" uuid REFERENCES "jobs"("id"),
  "category" varchar(100) NOT NULL,
  "description" text NOT NULL,
  "amount" decimal(10, 2) NOT NULL,
  "gst_amount" decimal(10, 2) DEFAULT 0 NOT NULL,
  "total_amount" decimal(10, 2) NOT NULL,
  "receipt_url" text,
  "expense_date" timestamp NOT NULL,
  "status" varchar(50) DEFAULT 'pending' NOT NULL,
  "approved_by_user_id" uuid REFERENCES "users"("id"),
  "approved_at" timestamp,
  "rejection_reason" text,
  "reimbursed_at" timestamp,
  "xero_expense_id" varchar(255),
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "appointments_organization_id_idx" ON "appointments"("organization_id");
CREATE INDEX IF NOT EXISTS "appointments_assigned_to_user_id_idx" ON "appointments"("assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "appointments_start_time_idx" ON "appointments"("start_time");
CREATE INDEX IF NOT EXISTS "appointments_job_id_idx" ON "appointments"("job_id");

CREATE INDEX IF NOT EXISTS "expenses_organization_id_idx" ON "expenses"("organization_id");
CREATE INDEX IF NOT EXISTS "expenses_user_id_idx" ON "expenses"("user_id");
CREATE INDEX IF NOT EXISTS "expenses_status_idx" ON "expenses"("status");
CREATE INDEX IF NOT EXISTS "expenses_job_id_idx" ON "expenses"("job_id");
