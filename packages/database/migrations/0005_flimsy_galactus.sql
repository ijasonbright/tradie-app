CREATE TABLE IF NOT EXISTS "client_reminder_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"disable_invoice_reminders" boolean DEFAULT false NOT NULL,
	"disable_monthly_statements" boolean DEFAULT false NOT NULL,
	"preferred_reminder_method" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reminder_type" varchar(50) NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_id" uuid,
	"sent_via" varchar(20) NOT NULL,
	"recipient_email" varchar(255),
	"recipient_phone" varchar(50),
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"days_before_due" integer,
	"invoice_amount" varchar(50),
	"credits_used" integer DEFAULT 0,
	"sms_message_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminder_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_reminders_enabled" boolean DEFAULT true NOT NULL,
	"reminder_days_before_due" text DEFAULT '7,3,1',
	"reminder_days_after_due" text DEFAULT '1,7,14',
	"invoice_reminder_method" varchar(20) DEFAULT 'email' NOT NULL,
	"enable_sms_escalation" boolean DEFAULT true NOT NULL,
	"sms_escalation_days_overdue" integer DEFAULT 14 NOT NULL,
	"monthly_statements_enabled" boolean DEFAULT true NOT NULL,
	"statement_day_of_month" integer DEFAULT 1 NOT NULL,
	"statement_method" varchar(20) DEFAULT 'email' NOT NULL,
	"include_only_outstanding" boolean DEFAULT true NOT NULL,
	"invoice_reminder_email_template_id" uuid,
	"invoice_reminder_sms_template_id" uuid,
	"monthly_statement_email_template_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_reminder_preferences" ADD CONSTRAINT "client_reminder_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_history" ADD CONSTRAINT "reminder_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_settings" ADD CONSTRAINT "reminder_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
