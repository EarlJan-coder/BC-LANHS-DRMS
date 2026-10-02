-- drizzle/0003_cleanup_redundant_columns.sql
ALTER TABLE "request_status_history" DROP COLUMN "old_status";--> statement-breakpoint
ALTER TABLE "request_status_history" DROP COLUMN "new_status";--> statement-breakpoint
ALTER TABLE "request_status_history" DROP COLUMN "changed_by";--> statement-breakpoint
ALTER TABLE "grade_import_batches" DROP COLUMN "uploaded_by";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN "actor_id";--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" DROP COLUMN "actor_id";
