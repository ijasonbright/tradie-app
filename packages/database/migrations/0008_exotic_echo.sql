CREATE TABLE IF NOT EXISTS "job_completion_form_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"completion_form_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_id" varchar(100),
	"value" text,
	"value_numeric" integer,
	"file_category" varchar(100),
	"file_path" varchar(500),
	"file_ref" varchar(255),
	"file_suffix" varchar(50),
	"file_name" varchar(255),
	"file_size" integer,
	"submission_type_id" integer DEFAULT 0,
	"csv_question_id" integer,
	"csv_answer_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_answers" ADD CONSTRAINT "job_completion_form_answers_completion_form_id_job_completion_forms_id_fk" FOREIGN KEY ("completion_form_id") REFERENCES "public"."job_completion_forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_answers" ADD CONSTRAINT "job_completion_form_answers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_answers" ADD CONSTRAINT "job_completion_form_answers_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_completion_form_answers" ADD CONSTRAINT "job_completion_form_answers_question_id_completion_form_template_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."completion_form_template_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
