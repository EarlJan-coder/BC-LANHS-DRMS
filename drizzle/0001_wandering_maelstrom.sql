CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('enrolled', 'alumni', 'transferred', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."student_type" AS ENUM('current', 'alumni', 'transferee');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'certificate' BEFORE 'system';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'alumni' BEFORE 'registrar';--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_number" varchar(60) NOT NULL,
	"request_id" uuid,
	"student_id" uuid,
	"certificate_type" varchar(120) NOT NULL,
	"school_year_id" uuid,
	"pdf_url" text,
	"verification_code" varchar(80) NOT NULL,
	"qr_code_data" text NOT NULL,
	"generated_by" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blockchain_tx_hash" varchar(90),
	"record_hash" varchar(66),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "sections_grade_level_name_idx";--> statement-breakpoint
DROP INDEX "blockchain_audit_logs_status_idx";--> statement-breakpoint
ALTER TABLE "grade_levels" ALTER COLUMN "order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "request_status_history" ALTER COLUMN "to_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "reference_type" varchar(80) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "blockchain_status" "blockchain_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "school_year_needed" varchar(40);--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "grade_level_needed" varchar(40);--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "registrar_remarks" text;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "ready_for_pickup_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD COLUMN "batch_number" varchar(60) DEFAULT ('BATCH-' || substring(gen_random_uuid()::text from 1 for 18)) NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD COLUMN "uploaded_by" uuid;--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD COLUMN "imported_rows" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD COLUMN "blockchain_tx_hash" varchar(90);--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD COLUMN "record_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_import_errors" ADD COLUMN "error_message" text DEFAULT 'Migrated import error' NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_levels" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_levels" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD COLUMN "old_status" "request_status";--> statement-breakpoint
ALTER TABLE "request_status_history" ADD COLUMN "new_status" "request_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD COLUMN "changed_by" uuid;--> statement-breakpoint
ALTER TABLE "school_years" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "school_year_id" uuid;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_grades" ADD COLUMN "encoded_by" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "gender" varchar(30);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "email" varchar(191);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "school_year_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "student_type" "student_type" DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "status" "student_status" DEFAULT 'enrolled' NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "middle_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_number_idx" ON "certificates" USING btree ("certificate_number");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_verification_code_idx" ON "certificates" USING btree ("verification_code");--> statement-breakpoint
CREATE INDEX "certificates_student_idx" ON "certificates" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "certificates_request_idx" ON "certificates" USING btree ("request_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ADD CONSTRAINT "blockchain_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD CONSTRAINT "grade_import_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_encoded_by_users_id_fk" FOREIGN KEY ("encoded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "document_requests_requested_by_idx" ON "document_requests" USING btree ("requested_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_import_batches_number_idx" ON "grade_import_batches" USING btree ("batch_number");--> statement-breakpoint
CREATE INDEX "grade_import_batches_uploaded_by_idx" ON "grade_import_batches" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "sections_school_year_id_idx" ON "sections" USING btree ("school_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_grade_level_year_name_idx" ON "sections" USING btree ("grade_level_id","school_year_id","name");--> statement-breakpoint
CREATE INDEX "students_grade_level_idx" ON "students" USING btree ("grade_level_id");--> statement-breakpoint
CREATE INDEX "students_section_idx" ON "students" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blockchain_audit_logs_status_idx" ON "blockchain_audit_logs" USING btree ("blockchain_status");
