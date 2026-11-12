ALTER TABLE "certificates" ADD COLUMN "override_strand" varchar(100);--> statement-breakpoint
ALTER TABLE "document_requests" ADD COLUMN "strand_needed" varchar(40);