UPDATE "users" SET "status" = 'inactive' WHERE "status" = 'suspended';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."account_status";--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."account_status";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" SET DATA TYPE "public"."account_status" USING "status"::"public"."account_status";