-- Cleanup: remove all data connected to grades, grade imports, subjects, and Certificate of Grades requests.
--
-- Certificate of Grades (COG) rows are matched by name ("certificate of grades" case-insensitively, or
-- "cog" as a whole word — the word-boundary regex keeps names like "Certificate of Recognition", whose
-- letters contain "cog", out of the delete set) or by linkage: a certificate whose request is a COG
-- request is deleted together with that request, so the later DELETE FROM "document_requests" cannot
-- trip the certificates_request_idx foreign key mid-file after data has already been deleted.

-- 1. Status history for Certificate of Grades requests
DELETE FROM "request_status_history"
WHERE "request_id" IN (
  SELECT dr."id" FROM "document_requests" dr
  JOIN "document_types" dt ON dr."document_type_id" = dt."id"
  WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
     OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
);--> statement-breakpoint

-- 2. Blockchain audit logs tied to grade import batches, COG certificates, COG requests, or local audit logs being removed
DELETE FROM "blockchain_audit_logs"
WHERE "reference_type" = 'grade_import_batch'
   OR "reference_id" IN (
     SELECT dr."tracking_number" FROM "document_requests" dr
     JOIN "document_types" dt ON dr."document_type_id" = dt."id"
     WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
        OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
   )
   OR "reference_id" IN (
     SELECT c."certificate_number" FROM "certificates" c
     WHERE lower(coalesce(c."certificate_type",'')) LIKE '%certificate of grades%'
        OR lower(coalesce(c."certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        OR c."request_id" IN (
          SELECT dr."id" FROM "document_requests" dr
          JOIN "document_types" dt ON dr."document_type_id" = dt."id"
          WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
             OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        )
   )
   OR "audit_log_id" IN (
     SELECT al."id" FROM "audit_logs" al
     WHERE al."entity_type" IN ('grade_import_batch', 'grade_import_error', 'student_grade', 'subject')
        OR al."entity_id" IN (
          SELECT dr."id"::text FROM "document_requests" dr
          JOIN "document_types" dt ON dr."document_type_id" = dt."id"
          WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
             OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        )
        OR al."entity_id" IN (
          SELECT c."id"::text FROM "certificates" c
          WHERE lower(coalesce(c."certificate_type",'')) LIKE '%certificate of grades%'
             OR lower(coalesce(c."certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
             OR c."request_id" IN (
               SELECT dr."id" FROM "document_requests" dr
               JOIN "document_types" dt ON dr."document_type_id" = dt."id"
               WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
                  OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
             )
        )
   );--> statement-breakpoint

-- 3. Local audit logs tied to grades, subjects, and COG records
DELETE FROM "audit_logs"
WHERE "entity_type" IN ('grade_import_batch', 'grade_import_error', 'student_grade', 'subject')
   OR "entity_id" IN (
     SELECT dr."id"::text FROM "document_requests" dr
     JOIN "document_types" dt ON dr."document_type_id" = dt."id"
     WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
        OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
   )
   OR "entity_id" IN (
     SELECT c."id"::text FROM "certificates" c
     WHERE lower(coalesce(c."certificate_type",'')) LIKE '%certificate of grades%'
        OR lower(coalesce(c."certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        OR c."request_id" IN (
          SELECT dr."id" FROM "document_requests" dr
          JOIN "document_types" dt ON dr."document_type_id" = dt."id"
          WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
             OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
        )
   );--> statement-breakpoint

-- 4. Grade notifications (must run before the notification_type enum is rebuilt)
DELETE FROM "notifications" WHERE "type" = 'grade';--> statement-breakpoint

-- 5. Notifications generated for the certificates deleted below ("... has been generated ..."), matched
--    by the certificate number appearing in the message. There is no foreign key, so these must be
--    purged before the certificates are deleted. The certificate set is exactly the set deleted in step 6.
DELETE FROM "notifications" AS "n"
WHERE EXISTS (
  SELECT 1 FROM "certificates" c
  WHERE c."certificate_number" <> ''
    AND strpos("n"."message", c."certificate_number") > 0
    AND (lower(coalesce(c."certificate_type",'')) LIKE '%certificate of grades%'
      OR lower(coalesce(c."certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
      OR c."request_id" IN (
        SELECT dr."id" FROM "document_requests" dr
        JOIN "document_types" dt ON dr."document_type_id" = dt."id"
        WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
           OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
      ))
);--> statement-breakpoint

-- 6. Generated Certificate of Grades (matched by certificate_type OR by request linkage, so a
--    certificate whose request is a COG request cannot survive and block the request delete below)
DELETE FROM "certificates"
WHERE lower(coalesce("certificate_type",'')) LIKE '%certificate of grades%'
   OR lower(coalesce("certificate_type",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
   OR "request_id" IN (
     SELECT dr."id" FROM "document_requests" dr
     JOIN "document_types" dt ON dr."document_type_id" = dt."id"
     WHERE lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
        OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
   );--> statement-breakpoint

-- 7. Notifications referencing Certificate of Grades requests (matched by the request tracking
--    number appearing in the message). There is no foreign key, so these rows must be purged
--    before the requests themselves are deleted.
DELETE FROM "notifications" AS "n"
WHERE EXISTS (
  SELECT 1 FROM "document_requests" dr
  JOIN "document_types" dt ON dr."document_type_id" = dt."id"
  WHERE (lower(coalesce(dt."name",'')) LIKE '%certificate of grades%'
      OR lower(coalesce(dt."name",'')) ~ '(^|[^a-z])cog([^a-z]|$)')
    AND dr."tracking_number" <> ''
    AND strpos("n"."message", dr."tracking_number") > 0
);--> statement-breakpoint

-- 8. Certificate of Grades requests
DELETE FROM "document_requests"
WHERE "document_type_id" IN (
  SELECT "id" FROM "document_types"
  WHERE lower(coalesce("name",'')) LIKE '%certificate of grades%'
     OR lower(coalesce("name",'')) ~ '(^|[^a-z])cog([^a-z]|$)'
);--> statement-breakpoint

-- 9. Certificate of Grades document type
DELETE FROM "document_types"
WHERE lower(coalesce("name",'')) LIKE '%certificate of grades%'
   OR lower(coalesce("name",'')) ~ '(^|[^a-z])cog([^a-z]|$)';--> statement-breakpoint

DROP TABLE "grade_import_batches" CASCADE;--> statement-breakpoint
DROP TABLE "grade_import_errors" CASCADE;--> statement-breakpoint
DROP TABLE "student_grades" CASCADE;--> statement-breakpoint
DROP TABLE "subjects" CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system'::text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('request', 'certificate', 'system', 'audit');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system'::"public"."notification_type";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";
