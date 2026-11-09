CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "section_needed" varchar(40);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "reference_type" varchar(40);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "reference_id" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registration_status" "registration_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
DROP INDEX "students_grade_level_idx";--> statement-breakpoint
DROP INDEX "students_section_idx";--> statement-breakpoint
ALTER TABLE "certificates" DROP COLUMN "school_year_id";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "guardian_name";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "guardian_contact";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "grade_level_id";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "section_id";--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "school_year_id";--> statement-breakpoint
ALTER TABLE "sections" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sections" CASCADE;--> statement-breakpoint
ALTER TABLE "grade_levels" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "grade_levels" CASCADE;--> statement-breakpoint
ALTER TABLE "school_years" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "school_years" CASCADE;