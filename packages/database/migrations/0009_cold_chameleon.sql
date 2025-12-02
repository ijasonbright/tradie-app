CREATE TABLE IF NOT EXISTS "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"external_property_id" integer NOT NULL,
	"address_street" varchar(255),
	"address_suburb" varchar(100),
	"address_state" varchar(50),
	"address_postcode" varchar(10),
	"property_type" varchar(50),
	"bedrooms" integer,
	"bathrooms" integer,
	"owner_name" varchar(255),
	"owner_phone" varchar(50),
	"owner_email" varchar(255),
	"tenant_name" varchar(255),
	"tenant_phone" varchar(50),
	"tenant_email" varchar(255),
	"access_instructions" text,
	"notes" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"photo_path" varchar(500) NOT NULL,
	"thumbnail_path" varchar(500),
	"photo_type" varchar(50) DEFAULT 'general',
	"caption" text,
	"taken_at" timestamp DEFAULT now(),
	"uploaded_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) DEFAULT 'OTHER' NOT NULL,
	"brand" varchar(255),
	"model" varchar(255),
	"serial_number" varchar(255),
	"room" varchar(100),
	"location" varchar(255),
	"condition" varchar(50) DEFAULT 'GOOD' NOT NULL,
	"estimated_age" integer,
	"warranty_status" varchar(50),
	"warranty_expiry" timestamp,
	"maintenance_required" varchar(50) DEFAULT 'NONE',
	"current_value" numeric(10, 2),
	"replacement_cost" numeric(10, 2),
	"expected_lifespan_years" integer,
	"years_remaining" numeric(5, 2),
	"replacement_year" integer,
	"notes" text,
	"external_asset_id" integer,
	"synced_at" timestamp,
	"captured_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_register_completion_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"asset_register_job_id" uuid NOT NULL,
	"template_id" uuid,
	"completed_by_user_id" uuid NOT NULL,
	"completion_date" timestamp,
	"form_data" jsonb NOT NULL,
	"client_signature_url" varchar(500),
	"technician_signature_url" varchar(500),
	"client_name" varchar(255),
	"technician_name" varchar(255),
	"pdf_url" varchar(500),
	"pdf_generated_at" timestamp,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"sent_to_client" boolean DEFAULT false,
	"sent_at" timestamp,
	"synced_to_property_pal" boolean DEFAULT false,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_register_form_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_register_job_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"used_by_email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_register_form_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_register_job_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_register_job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note_text" text NOT NULL,
	"note_type" varchar(50) DEFAULT 'general',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_register_job_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_register_job_id" uuid NOT NULL,
	"photo_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"photo_type" varchar(50) DEFAULT 'general',
	"caption" text,
	"room" varchar(100),
	"item" varchar(255),
	"uploaded_by_user_id" uuid,
	"taken_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_register_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"status" varchar(50) DEFAULT 'CREATED' NOT NULL,
	"priority" varchar(50) DEFAULT 'MEDIUM',
	"scheduled_date" timestamp,
	"started_date" timestamp,
	"completed_date" timestamp,
	"notes" text,
	"completion_notes" text,
	"report_data" jsonb,
	"external_request_id" integer,
	"external_source" varchar(50) DEFAULT 'property_pal',
	"external_synced_at" timestamp,
	"external_property_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "external_agency_id" integer;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "external_source" varchar(50);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "external_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "external_work_order_id" varchar(100);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "external_source" varchar(50);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "external_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "external_property_id" varchar(100);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "approval_response_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "approval_response_by" varchar(100);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "job_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_photos" ADD CONSTRAINT "asset_photos_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_template_id_completion_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."completion_form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_form_tokens" ADD CONSTRAINT "asset_register_form_tokens_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_job_notes" ADD CONSTRAINT "asset_register_job_notes_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_job_notes" ADD CONSTRAINT "asset_register_job_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_job_photos" ADD CONSTRAINT "asset_register_job_photos_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_job_photos" ADD CONSTRAINT "asset_register_job_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_jobs" ADD CONSTRAINT "asset_register_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_jobs" ADD CONSTRAINT "asset_register_jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_register_jobs" ADD CONSTRAINT "asset_register_jobs_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotes" ADD CONSTRAINT "quotes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
