import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function main() {
  console.log('Applying Asset Register migration...');

  try {
    // Create asset_register_jobs table
    await pool.query(`
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
    `);
    console.log('✓ Created asset_register_jobs table');

    // Create asset_register_job_photos table
    await pool.query(`
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
    `);
    console.log('✓ Created asset_register_job_photos table');

    // Create asset_register_job_notes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "asset_register_job_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "asset_register_job_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "note_text" text NOT NULL,
        "note_type" varchar(50) DEFAULT 'general',
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ Created asset_register_job_notes table');

    // Create asset_register_completion_forms table
    await pool.query(`
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
    `);
    console.log('✓ Created asset_register_completion_forms table');

    // Create asset_register_form_tokens table
    await pool.query(`
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
    `);
    console.log('✓ Created asset_register_form_tokens table');

    // Add foreign key constraints
    const foreignKeys = [
      {
        name: 'asset_register_jobs_organization_id_fk',
        sql: `ALTER TABLE "asset_register_jobs" ADD CONSTRAINT "asset_register_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_jobs_property_id_fk',
        sql: `ALTER TABLE "asset_register_jobs" ADD CONSTRAINT "asset_register_jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_jobs_assigned_to_user_id_fk',
        sql: `ALTER TABLE "asset_register_jobs" ADD CONSTRAINT "asset_register_jobs_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_job_photos_job_id_fk',
        sql: `ALTER TABLE "asset_register_job_photos" ADD CONSTRAINT "asset_register_job_photos_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;`
      },
      {
        name: 'asset_register_job_photos_user_id_fk',
        sql: `ALTER TABLE "asset_register_job_photos" ADD CONSTRAINT "asset_register_job_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_job_notes_job_id_fk',
        sql: `ALTER TABLE "asset_register_job_notes" ADD CONSTRAINT "asset_register_job_notes_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;`
      },
      {
        name: 'asset_register_job_notes_user_id_fk',
        sql: `ALTER TABLE "asset_register_job_notes" ADD CONSTRAINT "asset_register_job_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_completion_forms_org_id_fk',
        sql: `ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_completion_forms_job_id_fk',
        sql: `ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;`
      },
      {
        name: 'asset_register_completion_forms_template_id_fk',
        sql: `ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_template_id_completion_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."completion_form_templates"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_completion_forms_user_id_fk',
        sql: `ALTER TABLE "asset_register_completion_forms" ADD CONSTRAINT "asset_register_completion_forms_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;`
      },
      {
        name: 'asset_register_form_tokens_job_id_fk',
        sql: `ALTER TABLE "asset_register_form_tokens" ADD CONSTRAINT "asset_register_form_tokens_asset_register_job_id_asset_register_jobs_id_fk" FOREIGN KEY ("asset_register_job_id") REFERENCES "public"."asset_register_jobs"("id") ON DELETE cascade ON UPDATE no action;`
      },
    ];

    for (const fk of foreignKeys) {
      try {
        await pool.query(fk.sql);
        console.log(`✓ Added foreign key: ${fk.name}`);
      } catch (err: any) {
        if (err.code === '42710') { // duplicate_object
          console.log(`  (skipped) ${fk.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
