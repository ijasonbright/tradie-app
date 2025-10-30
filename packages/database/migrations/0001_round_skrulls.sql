CREATE TABLE IF NOT EXISTS "team_member_unavailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"unavailability_type" varchar(50) NOT NULL,
	"start_datetime" timestamp NOT NULL,
	"end_datetime" timestamp NOT NULL,
	"all_day" boolean DEFAULT false,
	"notes" text,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type_id" integer,
	"name" varchar(100) NOT NULL,
	"client_hourly_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"client_first_hour_rate" numeric(10, 2),
	"client_callout_fee" numeric(10, 2) DEFAULT '0',
	"client_after_hours_callout_fee" numeric(10, 2) DEFAULT '0',
	"client_after_hours_extra_percent" numeric(5, 2) DEFAULT '0',
	"default_employee_hourly_rate" numeric(10, 2) DEFAULT '0',
	"default_employee_daily_rate" numeric(10, 2),
	"client_daily_rate" numeric(10, 2),
	"default_employee_cost" numeric(10, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_types_organization_id_job_type_id_unique" UNIQUE("organization_id","job_type_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"appointment_type" varchar(50) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false,
	"job_id" uuid,
	"client_id" uuid,
	"assigned_to_user_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"location_address" text,
	"reminder_minutes_before" varchar(50),
	"reminder_sent_at" timestamp,
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"category" varchar(100) NOT NULL,
	"supplier_name" varchar(255),
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"gst_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"receipt_url" text,
	"expense_date" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"reimbursed_at" timestamp,
	"xero_expense_id" varchar(255),
	"account_code" varchar(50),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "primary_color" varchar(7);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_name" varchar(100);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_bsb" varchar(10);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_account_number" varchar(50);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "bank_account_name" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_hourly_rate" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_employee_cost" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "employment_type" varchar(50) DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "billing_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "leave_balance_hours" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "available_for_scheduling" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "document_category" varchar(50);--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "verification_notes" varchar(500);--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "ai_verification_status" varchar(50);--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "ai_verification_notes" varchar(500);--> statement-breakpoint
ALTER TABLE "user_documents" ADD COLUMN "ai_extracted_expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "job_time_logs" ADD COLUMN "billing_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "trade_type_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "pricing_type" varchar(50) DEFAULT 'time_and_materials';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimated_duration_hours" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "actual_duration_hours" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "travel_time_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "site_latitude" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "site_longitude" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "site_place_id" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_member_unavailability" ADD CONSTRAINT "team_member_unavailability_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_member_unavailability" ADD CONSTRAINT "team_member_unavailability_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_member_unavailability" ADD CONSTRAINT "team_member_unavailability_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_types" ADD CONSTRAINT "trade_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_trade_type_id_trade_types_id_fk" FOREIGN KEY ("trade_type_id") REFERENCES "public"."trade_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
