CREATE TABLE IF NOT EXISTS "payment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"related_quote_id" uuid,
	"related_invoice_id" uuid,
	"related_job_id" uuid,
	"client_id" uuid NOT NULL,
	"amount_requested" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_payment_link_id" varchar(255),
	"stripe_payment_link_url" varchar(500),
	"public_token" varchar(100) NOT NULL,
	"description" text,
	"expires_at" timestamp,
	"paid_at" timestamp,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requests_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_payment_intent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_payment_link_url" varchar(500);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "public_token" varchar(100);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_by_name" varchar(255);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_by_email" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_payment_link_id" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "stripe_payment_link_url" varchar(500);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "public_token" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_deposit_invoice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "related_quote_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_related_quote_id_quotes_id_fk" FOREIGN KEY ("related_quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_related_invoice_id_invoices_id_fk" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_related_job_id_jobs_id_fk" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_quote_id_quotes_id_fk" FOREIGN KEY ("related_quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_public_token_unique" UNIQUE("public_token");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_public_token_unique" UNIQUE("public_token");