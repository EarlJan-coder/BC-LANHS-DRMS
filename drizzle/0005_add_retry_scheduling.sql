ALTER TABLE "blockchain_audit_logs" ADD COLUMN "last_retry_at" timestamp with time zone;
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "next_retry_at" timestamp with time zone;
