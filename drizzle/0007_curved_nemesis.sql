CREATE TABLE "auth_rate_limits" (
	"bucket_key" varchar(64) PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "lrn" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_rate_limits_updated_idx" ON "auth_rate_limits" USING btree ("updated_at");