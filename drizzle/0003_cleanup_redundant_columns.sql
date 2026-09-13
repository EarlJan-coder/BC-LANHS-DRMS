-- drizzle/0003_cleanup_redundant_columns.sql
ALTER TABLE "request_status_history" DROP COLUMN "old_status";
ALTER TABLE "request_status_history" DROP COLUMN "changed_by";
ALTER TABLE "grade_import_batches" DROP COLUMN "uploaded_by";
ALTER TABLE "audit_logs" DROP COLUMN "actor_id";
ALTER TABLE "blockchain_audit_logs" DROP COLUMN "status";