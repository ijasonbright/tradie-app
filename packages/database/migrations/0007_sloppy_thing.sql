CREATE TABLE IF NOT EXISTS "completion_form_template_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"is_collapsible" boolean DEFAULT true,
	"is_completion_group" boolean DEFAULT false,
	"conditional_logic" jsonb,
	"csv_group_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "completion_form_template_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"placeholder" varchar(255),
	"help_text" text,
	"help_url" varchar(500),
	"default_value" text,
	"field_type" varchar(50) NOT NULL,
	"config" jsonb,
	"is_required" boolean DEFAULT false,
	"validation_message" text,
	"validation_rules" jsonb,
	"sort_order" integer NOT NULL,
	"column_span" integer DEFAULT 1,
	"conditional_logic" jsonb,
	"answer_options" jsonb,
	"csv_question_id" integer,
	"csv_group_no" integer,
	"csv_field" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "completion_form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"code" varchar(100),
	"job_type" varchar(50),
	"is_global" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"navigation_type" varchar(50) DEFAULT 'tabs',
	"include_photos" boolean DEFAULT true,
	"include_before_after_photos" boolean DEFAULT true,
	"include_signature" boolean DEFAULT true,
	"include_technician_signature" boolean DEFAULT true,
	"site_id" integer,
	"csv_job_type_id" integer,
	"csv_form_type_id" integer,
	"site_group_id" integer,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_completion_form_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"completion_form_id" uuid NOT NULL,
	"question_id" uuid,
	"photo_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500),
	"caption" text,
	"photo_type" varchar(50),
	"sort_order" integer DEFAULT 0,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_completion_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "completion_form_template_groups" ADD CONSTRAINT "completion_form_template_groups_template_id_completion_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."completion_form_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "completion_form_template_questions" ADD CONSTRAINT "completion_form_template_questions_template_id_completion_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."completion_form_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "completion_form_template_questions" ADD CONSTRAINT "completion_form_template_questions_group_id_completion_form_template_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."completion_form_template_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "completion_form_templates" ADD CONSTRAINT "completion_form_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "completion_form_templates" ADD CONSTRAINT "completion_form_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_photos" ADD CONSTRAINT "job_completion_form_photos_completion_form_id_job_completion_forms_id_fk" FOREIGN KEY ("completion_form_id") REFERENCES "public"."job_completion_forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_photos" ADD CONSTRAINT "job_completion_form_photos_question_id_completion_form_template_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."completion_form_template_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_photos" ADD CONSTRAINT "job_completion_form_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_forms" ADD CONSTRAINT "job_completion_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_forms" ADD CONSTRAINT "job_completion_forms_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_forms" ADD CONSTRAINT "job_completion_forms_template_id_completion_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."completion_form_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_forms" ADD CONSTRAINT "job_completion_forms_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
