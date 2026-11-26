CREATE TABLE "document_type_templates" (
	"document_type_id" uuid PRIMARY KEY NOT NULL,
	"layout_key" varchar(40) DEFAULT 'enrolment-jhs' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"principal_title" text DEFAULT 'Principal IV' NOT NULL,
	"registrar_title" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_type_templates" ADD CONSTRAINT "document_type_templates_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE cascade ON UPDATE no action;