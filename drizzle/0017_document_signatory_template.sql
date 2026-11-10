CREATE TABLE "document_signatory_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"registrar_name" varchar(200) DEFAULT '' NOT NULL,
	"principal_name" varchar(200) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
