# Student registration approval — design

Date: 2026-11-09
Status: Approved by human partner. Awaiting builder check.

## Intent and why

Students cannot enter the system on their own today. A registrar must pre-create each
student record by hand (`/registrar/students` add form) or bulk-import a spreadsheet
(`/registrar/students/import`). Only after that can a student self-register at
`/sign-up`, and signup refuses unless the LRN and first/last name match a pre-created
unlinked record exactly (`STUDENT_MATCH_FAILED` gate in
`src/app/api/auth/signup/route.ts`).

The beneficiary wants the reverse: the student registers themselves, a human approves or
declines, and the student hears back by email. They also want academic structure out of
the system entirely — no grade levels, sections, school years, or advisers — and want
documents to be the thing admin manages.

## Goals

1. Student self-registration is the only way a student enters the system.
2. Registrar and admin approve or decline each registration, with a note that reaches the
   student by email.
3. Grade levels, sections, school years, and advisers leave the system entirely.
4. Document types become manageable in admin (add, edit, deactivate).
5. Every list page paginates.
6. Certificates keep naming grade level, section, and school year — sourced from the
   document request instead of deleted lookup tables.
7. Notifications show keyword-only summaries and open full record details on click.

## Non-goals

- No grading, teachers, class lists, or scheduling of any kind.
- No bulk entry of students, in any form.
- Dashboards keep their deliberately short "recent items" lists unpaged.

## Anti-goals

- Do not leave orphaned columns, nav links, or routes referencing academic concepts
  after removal. A half-removed concept is worse than none.
- Do not let a pending or declined account authenticate, even briefly.
- Do not change the blockchain canonical hash shape.

## Constraints

- Next.js app with Drizzle ORM against Postgres. Schema lives in `src/db/schema.ts`;
  migrations in `drizzle/`.
- Email goes out through Resend (`src/lib/email.ts`, `RESEND_API_KEY`).
- Auth uses a session token cookie (`src/lib/session-token.ts`) with a `tokenVersion`
  for revocation, and a rate limiter on auth endpoints (`src/lib/auth-rate-limit.ts`).
- Audit logging hashes a canonical payload (`src/lib/audit/canonical.ts`) written to
  chain. The hash shape must not change.
- Existing tests run under `node:test` and live beside sources as `*.test.ts`.

---

## Decisions made with the human partner

### Registration fields

`/sign-up` collects: LRN, First Name, Middle Name, Last Name, Email, Phone, Address,
Password. Middle name, phone, and address are new. Guardian is dropped entirely —
it does not connect to requesting a document — and since the registrar add-form is also
removed, nothing would capture it again.

### Signup creates both records, with no match gate

Signup creates the `users` row and the `students` row together. The
`STUDENT_MATCH_FAILED` match-against-pre-existing-record logic is deleted. The account is
created **pending** and no session starts; the student is told to check their email.

### Approval queue is minimal

A Pending registrations surface for registrar and admin shows exactly: name, email,
Approve, Decline, and a note field. Whatever is decided, the note goes into an email to
the registration address carrying the outcome and the reason.

Approved accounts can sign in; declined ones cannot. A declined record stays on file
marked declined so the same LRN cannot immediately retry.

### Academic structure is removed from the whole system

Confirmed by the human partner: removal is system-wide, not just hidden admin screens.

### Document types become manageable

Admin keeps Document types and gains add, edit, and deactivate. Today
`/admin/document-types` is a read-only table of name, code, processing days, status.

### Certificate wording is preserved

The human partner explicitly does not want grade level, section, and school year to
vanish from certificate wording. Those values move to the **document request form as
free-text fields the student types** (section is new; school year and grade level already
exist as `school_year_needed` and `grade_level_needed`). Certificate text reads them from
the request instead of the deleted lookup tables.

### Student records page: View button and modal

The registrar can edit student records, but the table row exposes only a **View** button.
It opens a modal where the record is editable in place, with Save, Cancel, and Delete.

### Notifications are clickable with modal details

Notification rows show keyword-only summaries. Clicking opens a modal with the full
record behind it and marks the notification read. The modal was chosen over navigation
because registration notifications have no page to land on, and one behaviour across all
notification types is simpler.

### Delivery

Build it, then commit and push to a new branch, then merge to main for production.

---

## What is left to the builder

Everything below is implementation. The design fixes *what* and the visible behaviour;
the builder decides the mechanics.

### Schema and migration

- Drop tables `school_years`, `grade_levels`, `sections`.
- Drop columns: `students.grade_level_id`, `students.section_id`,
  `students.school_year_id`, `students.guardian_name`, `students.guardian_contact`,
  `certificates.school_year_id`.
- Add `document_requests.section_needed` alongside the existing `school_year_needed`
  and `grade_level_needed`.
- Add a registration approval status to `users` (or an equivalent). It must distinguish
  pending, approved, and declined and gate authentication.
- Add `reference_type` and `reference_id` to `notifications`.
- Decide whether existing rows need backfill and how the migration orders drops against
  FKs.

### Auth and signup

Rewrite `src/app/api/auth/signup/route.ts` to create both records with no match gate,
default to pending, and not start a session. The login path must reject pending and
declined accounts with a distinct message. Preserve the existing rate limiting and the
no-enumeration response property (signup must not reveal which LRNs or emails exist).
Preserve the bcrypt-before-transaction comment's intent.

### Approval surface

New route(s) for listing pending registrations and recording an approve/decline decision
with a note. Registrar and admin both get access. The decision writes an audit entry and
sends the email through `src/lib/email.ts`.

### Registrar student records

Remove the add form and the import page and the three `/api/students/import/*` routes
(`validate`, `template`, `commit`).
Restyle the list to LRN | Name | Email | Phone | Account | Status | View. Replace the
edit/delete row actions with a single View button opening the editable modal.

### Certificates

Repoint certificate text and the `schoolYear` hash input at the request's free-text
fields. Keep the canonical payload shape in `src/lib/audit/canonical.ts` exactly as it is.

### Pagination

A shared URL-bound pager applied to: audit logs (registrar), blockchain trail (admin),
users, student records, certificates, requests (registrar and student), notifications,
reports, search results. Backing queries return total counts so the pager shows real page
numbers rather than the current silent `.limit(50)` / `.limit(100)` cutoffs.

### Notifications

Keyword-only row text; modal detail on click; mark-read on open. Populate
`reference_type` / `reference_id` at every notification creation site in
`src/lib/services/certificates.ts`, `src/lib/services/document-requests.ts`, and
`src/lib/services/notifications.ts`. New registration notifications go to registrar and
admin, and their modal carries approve/decline. Approval notifies the student in-app and
by email; decline notifies by email only.

### Document types edit mode

Add, edit, and deactivate on `/admin/document-types`, plus the service and route
mutations behind them.

### Tests

Existing `*.test.ts` files reference removed tables and columns — notably
`src/lib/services/academic-setup.test.ts` and `src/lib/services/student-import.test.ts`.
Remove them and add coverage for the new signup, approval, and pagination behaviour.

`src/lib/audit/canonical.test.ts` is **pure string fixtures and passes unchanged** — the
canonical shape is frozen. Do not delete it; optionally add cases for the new schoolYear
sourcing.

`package.json` `test:unit` is an explicit file list — remove the deleted entries, and drop
the stale `src/lib/services/email-triggers.test.ts` entry that points at a nonexistent file.

---

## Builder check — settled calls

The reviewer read the design against the code. These I settle myself:

- **Guardian removal surface is larger than stated.** Guardian is also edited by
  `src/components/profile-update-form.tsx`, `src/app/api/profile/route.ts`,
  `src/app/(portal)/student/profile/page.tsx` ("Contact & Guardian" card), and
  `src/components/student-record-actions.tsx`, and appears in `src/lib/types.ts` and
  `src/lib/validators.ts`. Strip all of it with the column drop.
- **Academic removal inventory** (delete in the same PR as the migration):
  `src/lib/services/academic-setup.ts`, `src/app/api/academic-setup/[entity]/route.ts` and
  `[entity]/[id]/route.ts`, `src/app/(portal)/admin/{academic-setup,school-years,grade-levels,sections}/page.tsx`,
  `src/components/academic-setup-manager.tsx`, `src/components/academic-setup-delete-action.tsx`,
  `src/lib/navigation.ts` (four admin links), `src/proxy.ts` (allowlist + matcher),
  `src/lib/services/portal-search.ts` (admin search returns sections results),
  `src/lib/services/live-data.ts` (`listSchoolYearViews`/`listGradeLevelViews`/
  `listSectionViews`/`getStudentRecordFormOptions`), `src/lib/validators.ts` mutation schemas.
- **Document-type CRUD already exists** inside `src/lib/services/academic-setup.ts` and the
  academic-setup API. Port it into a document-types service/route, keep
  `documentTypeMutationSchema`, and replace hard delete with `isActive = false`
  (deactivate, not delete).
- **Seed and bootstrap must be rewritten**, not left to fail: `scripts/seed.ts` inserts
  school years, grade levels, sections, and a guardian; `scripts/bootstrap-admin.ts` must set
  the new approval status. Keep `npm run db:seed` green.
- **Pagination must also fix in-memory list scans.** `getDocumentRequestView`,
  `getCertificateView`, and `getStudentDetailView` scan capped lists in memory today and
  404 past 100–200 rows. Convert them to indexed `WHERE` queries as part of this work.
- **Approval status gates three places** — `src/app/api/auth/login/route.ts`,
  `src/lib/auth.ts`, `src/proxy.ts` — and every new route must join the `src/proxy.ts`
  allowlist or it runs unauthenticated. Note `ensureCurrentDbUser()` returns `null` rather
  than throwing, so handlers must not assume an actor.
- **Login must not become an enumeration oracle.** Keep the single generic 401 for bad
  credentials and unknown users; show the pending/declined message only *after* the password
  verifies.
- **Admin needs a notifications surface** — there is no `/admin/notifications` page or nav
  item today. Mirror the registrar one and put the approval modal there too.
- **Registrar list column mapping:** Email = `students.email` (falling back to the linked
  user's), Phone = `students.contactNumber`, Account = registration status, Status =
  `students.enrollmentStatus`. The View modal edits names, LRN, email, phone, address, and
  status — not `birthDate`/`gender`/`studentType`, which are never surfaced today.
- **View-modal Delete keeps current semantics**: no delete when requests or certificates are
  linked. It removes the `students` row only, so the user account survives with no record
  and the LRN stays on `users` — stated in the modal's confirm text.
- **Keyword rule:** row text is `<type keyword> · <status keyword>`; identifiers live behind
  `reference_type`/`reference_id`. Pre-migration rows open a message-only modal. Use
  `type: "system"` + `reference_type: "registration"` rather than extending
  `notificationTypeEnum`, so no enum migration is needed.
- **Certificate generation requires `requestId`** and sources schoolYear from
  `request.schoolYearNeeded`; drop `schoolYearId` from `certificateGenerateSchema` and the
  four-lookup fallback chain. Decline requires a note. Email send failures are logged but
  non-blocking, matching every existing `sendWorkflowEmail` call site.
- **`scripts/check-migrations.ts`** destructive-delete gate does not know about the new drops;
  add a case for the new migration tag.
- **Grouped search results paginate per group** (its own page param and total), not one
  flattened stream.
- **`/registrar/students/[id]` stays** as the deep-link target for search and as the home for
  the certificates/request history, which don't belong in an edit modal. The View button
  opens the editable modal; the Name link opens the detail page.

## Builder check — answers from the human partner

1. **Unlinked pre-created student rows are deleted** by the migration. Those students
   re-register themselves through the new form. No LRN collision is carried forward.
2. **Decline is reversible.** A declined LRN is blocked from re-registering until a
   registrar or admin flips the record to approved from the student records modal. No
   permanent lockout, no timer.
3. **Signup returns an honest 409** — "an account already uses that email or LRN" — for
   both LRN and email collisions. Real users get a useful answer; LRN enumeration is
   accepted as the cost.
4. **Pre-launch, no legacy certificate data.** Nothing to preserve, so no snapshot
   migration. The hash shape is still frozen; the school year simply comes from the
   request going forward.
