-- drizzle/0004_add_blockchain_metadata.sql
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "block_number" bigint;
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "network" varchar(40);

ALTER TABLE "certificates" ADD COLUMN "block_number" bigint;
ALTER TABLE "certificates" ADD COLUMN "network" varchar(40);