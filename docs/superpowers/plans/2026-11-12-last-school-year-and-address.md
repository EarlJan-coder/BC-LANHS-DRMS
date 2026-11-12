# Last School Year attended + structured PH address

Date: 2026-11-12
Status: Approved by human partner. Inline execution.

## Intent and why

Registration must capture a required **Last School year attended**. That value lives on
the student's profile and flows automatically onto every document request the student
makes. The request form's free-text "School year needed" input goes away — grade level
and section stay free-text on the request form.

Registration also gains a required, structured address (City → Barangay cascading
dropdowns plus a free-text street line) for a small set of Cavite LGUs, editable later
from the student's profile.

## Global constraints

- Next.js app with Drizzle ORM against Postgres. Schema in `src/db/schema.ts`, migrations
  in `drizzle/`.
- The canonical audit hash shape in `src/lib/audit/canonical.ts` is **frozen**. Do not
  change `buildCanonicalDocumentRequest` inputs or its field set.
- Existing tests run under `node:test`, live beside sources as `*.test.ts`, and
  `package.json` `test:unit` is an explicit file list — new test files must be added there.
- No orphaned columns, nav links, or routes left behind (repo anti-goal).
- Guardian does not exist anywhere in the codebase; nothing to do for it.

## Decisions made with the human partner

- **Snapshot, not live link.** The school year is copied onto `document_requests.school_year_needed`
  at submission. Certificates and audit hashes already issued never change if the student
  later edits their profile.
- **Students can edit** last school year attended and address on their profile page.
- **Address is kept** (not removed) and upgraded: required City → Barangay cascading
  dropdowns plus a required free-text street line, composed into the existing
  `students.address` column so certificates, registrar views, and search keep working.
- **Scope of address data:** Trece Martires City plus Tanza, Naic, Indang, General Trias,
  Dasmariñas, Carmona, Tagaytay — full barangay lists, static JSON, no Region/Province.
- **Existing students with no last school year are blocked** from submitting document
  requests until they fill it in on their profile.
- **Grade level and section stay free-text** on the request form. They are not added to
  registration or profile.
- **Registrar's View modal** keeps a plain free-text address textarea (registrar edits in
  place) and gains a Last school year attended field.
- **Asterisks on every required registration field.**

## Tasks

### Task 1: PH address data module

Produce `src/lib/ph-address.ts` exporting the city/barangay dataset and address
composition.

- `CITIES`: the 8 approved cities, each with its full barangay list.
- `barangaysFor(city: string): string[]`.
- `composeAddress({ streetLine, barangay, city }): string` →
  `"123 Mabini St., Brgy. Aguado, Trece Martires City"`.
- Every city must have at least one barangay; unknown city returns `[]`.
- Test file `src/lib/ph-address.test.ts`, added to `package.json` `test:unit`.

Expected: `npm run test:unit` green including the new file.

### Task 2: Schema + migration

- `src/db/schema.ts`: add `lastSchoolYearAttended: varchar("last_school_year_attended", { length: 40 })`
  to `students`.
- Generate migration via `npm run db:generate` → `drizzle/0018_*.sql`, additive only.
- `npm run db:migrate` must stay green (`scripts/check-migrations.ts` gate).

Expected: migration file exists, `check-migrations` passes, suite green.

### Task 3: Signup captures last school year + structured address

`src/app/api/auth/signup/route.ts`:

- `signupSchema` gains `lastSchoolYearAttended: z.string().trim().min(1, "Last school year attended is required.").max(40)`.
- Address becomes required and structured: `addressCity`, `addressBarangay`, `addressStreetLine`
  (each required, max lengths sane), composed with `composeAddress` and written to
  `students.address`. `lastSchoolYearAttended` written to `students.lastSchoolYearAttended`.
- No-Enumeration and rate-limit behaviour preserved exactly.

`src/components/auth-form.tsx`:

- New required **Last school year attended** input (placeholder `2025-2026`, maxLength 40).
- Address block replaced by: City select → Barangay select (filtered by city) → Street line
  input. All required. Cities come from `CITIES`.
- **Asterisks on every required field label** (First name, Last name, Email, LRN,
  Password, Last school year attended, City, Barangay, Street line).

Tests: extend `src/app/api/auth/signup/route.test.ts` for the new required field, the
composed address, and missing-field 400s.

Expected: signup tests green.

### Task 4: Student profile shows and edits the new fields

- `src/lib/types.ts`: `StudentProfileView` and `StudentView` gain `lastSchoolYearAttended: string`.
- `src/lib/services/live-data.ts`: select/map the new column in profile, student list, and
  detail queries.
- `src/app/(portal)/student/profile/page.tsx`: Academic record card shows **Last school
  year attended** (fallback `Not set`).
- `src/components/profile-update-form.tsx`: modal gains Last school year attended (required)
  and Address (City → Barangay → street line, required), prefilled from existing values.
- `src/app/api/profile/route.ts`: `profileUpdateSchema` accepts `lastSchoolYearAttended`,
  `addressCity`, `addressBarangay`, `addressStreetLine`; writes composed address.

Tests: cover the profile PATCH accepting the new fields (new or extended test file added
to `test:unit`).

Expected: profile tests green, suite green.

### Task 5: Requests drop the school-year input and snapshot it

- `src/components/request-form.tsx`: remove the **School year needed** input and its
  payload key. Grade level and section inputs stay exactly as they are.
- `src/lib/validators.ts`: `documentRequestSchema` drops `schoolYearNeeded`.
- `src/lib/services/document-requests.ts` `createDocumentRequest`: read
  `student.lastSchoolYearAttended` and write it to `document_requests.school_year_needed`.
- **Blocking**: `getRequestEligibility` gains reason `no_school_year`, checked after the
  LRN check. `createDocumentRequest` throws 403 with a message pointing at the profile.
  `src/app/(portal)/student/requests/new/page.tsx` renders a message + "Go to profile"
  button for the new reason.

Tests: `src/lib/services/document-requests.test.ts` covers school year copied from the
profile and blocked-when-missing.

Expected: document-requests tests green.

### Task 6: Registrar surfaces + seed

- `src/lib/validators.ts` `studentRecordSchema`: gains `lastSchoolYearAttended` (optional
  in schema, trimmed to null when blank).
- `src/lib/services/student-records.ts` `updateStudentRecord`: persist it.
- `src/components/student-record-modal.tsx`: add a Last school year attended field.
- `src/app/(portal)/registrar/students/[id]/page.tsx`: show the value.
- `scripts/seed.ts`: seeded student gets a last school year.

Expected: suite green.

### Task 7: Final verification

- Full `npm run test:unit`, `npm run lint`, `npm run build`.

Expected: all three green.
