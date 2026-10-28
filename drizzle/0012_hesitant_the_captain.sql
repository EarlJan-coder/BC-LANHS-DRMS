ALTER TABLE "certificates" ADD COLUMN "override_registrar_name" varchar(200);--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "override_principal_name" varchar(200);