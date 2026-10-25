-- Remove old authentication accounts while retaining student, request, grade, certificate,
-- and audit rows. Historical user UUIDs remain on attribution columns; new writes are checked.
UPDATE "students" SET "user_id" = NULL WHERE "user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "document_requests" DROP CONSTRAINT "document_requests_requested_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "document_requests" DROP CONSTRAINT "document_requests_assigned_to_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "document_requests" DROP CONSTRAINT "document_requests_approved_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "document_requests" DROP CONSTRAINT "document_requests_rejected_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "request_status_history" DROP CONSTRAINT "request_status_history_actor_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "grade_import_batches" DROP CONSTRAINT "grade_import_batches_imported_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "student_grades" DROP CONSTRAINT "student_grades_encoded_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_generated_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_user_id_users_id_fk";--> statement-breakpoint
DELETE FROM "users";--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "grade_import_batches" ADD CONSTRAINT "grade_import_batches_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "student_grades" ADD CONSTRAINT "student_grades_encoded_by_users_id_fk" FOREIGN KEY ("encoded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
DROP INDEX "users_clerk_id_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lrn" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "lrn" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_lrn_idx" ON "users" USING btree ("lrn");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "clerk_id";
