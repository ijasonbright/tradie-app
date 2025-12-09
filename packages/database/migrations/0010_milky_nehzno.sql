CREATE TABLE IF NOT EXISTS "tradieconnect_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tc_user_id" varchar(255) NOT NULL,
	"tc_token" text NOT NULL,
	"tc_refresh_token" text,
	"tc_token_expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"connected_at" timestamp DEFAULT now(),
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "external_supplier_id" varchar(50);--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "external_source" varchar(50);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "property_manager_name" varchar(255);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "property_manager_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "property_manager_email" varchar(255);