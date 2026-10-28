ALTER TABLE "audit_logs" ALTER COLUMN "actor_role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ALTER COLUMN "actor_role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::text;--> statement-breakpoint
UPDATE "audit_logs" SET "actor_role" = 'student' WHERE "actor_role" = 'alumni';--> statement-breakpoint
UPDATE "blockchain_audit_logs" SET "actor_role" = 'student' WHERE "actor_role" = 'alumni';--> statement-breakpoint
UPDATE "users" SET "role" = 'student' WHERE "role" = 'alumni';--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'registrar', 'admin');--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "actor_role" SET DATA TYPE "public"."user_role" USING "actor_role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "blockchain_audit_logs" ALTER COLUMN "actor_role" SET DATA TYPE "public"."user_role" USING "actor_role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";