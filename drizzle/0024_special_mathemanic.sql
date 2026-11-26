DROP INDEX "document_types_code_idx";--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "current_school_year" varchar(40);--> statement-breakpoint
ALTER TABLE "document_types" DROP COLUMN "code";