ALTER TABLE "certificates" ADD COLUMN "override_student_name" varchar(200);--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "override_grade_level" varchar(100);--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "override_section" varchar(100);--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "override_purpose" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "override_date_generated" timestamp with time zone;