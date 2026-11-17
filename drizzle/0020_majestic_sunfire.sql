CREATE TABLE "document_template_wording" (
	"template_key" varchar(40) PRIMARY KEY NOT NULL,
	"title" text,
	"body" text,
	"principal_title" text,
	"registrar_title" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
