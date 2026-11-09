# Student Registration Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace registrar-side student entry with self-registration gated by registrar/admin approval, remove academic structure system-wide, and add clickable notifications and list pagination.

**Architecture:** A `registration_status` column on `users` gates authentication and drives a new approval surface. Signup creates both the `users` and `students` rows together with no match gate and no session. Academic tables and their columns are dropped in one migration, and certificate wording is re-sourced from free-text fields already on the request. List pages gain a shared URL-bound pager backed by counted queries.

**Tech Stack:** Next.js (App Router), Drizzle ORM + Postgres, Zod, Resend, `node:test` via `tsx`, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-09-student-registration-approval-design.md`

## Global Constraints

- The blockchain canonical hash shape is frozen. `src/lib/audit/canonical.ts` interfaces and field names must not change. `schoolYear` is sourced from `request.schoolYearNeeded`.
- Never let a `pending` or `declined` account start a session. Three gates must agree: `src/app/api/auth/login/route.ts`, `src/lib/auth.ts`, `src/proxy.ts`.
- Login keeps one generic 401 for bad credentials and unknown users. The pending/declined message appears only after `comparePassword` succeeds.
- Signup must not start a session. Response for duplicates is the honest 409: `"An account already uses that email or LRN."`
- Every new `/api/*` route must be added to both `protectedPrefixes` and `config.matcher` in `src/proxy.ts`, or it runs unauthenticated.
- `ensureCurrentDbUser()` returns `null` rather than throwing — never assume an actor.
- Email sends are logged and non-blocking. A failed send must not fail the request.
- Keep `npm run db:seed`, `npm run test:unit`, `npm run lint`, and `npm run build` green at every commit.
- Decline requires a note. Decline is reversible: a registrar or admin can flip a declined record to approved.
- Approval is available to `registrar` and `admin` roles only.
- Delivery: build on a new branch, push, then merge to `main` for production.

## Review Focus

1. **A pending or declined user with correct credentials must not get a session.** Login, proxy, and `getCurrentDbUser` can each be the one that leaks it. — Task 4 test `rejects a pending account after the password verifies`; Task 5 test `proxy blocks a pending user's token`.
2. **A new API route missing from the proxy allowlist is reachable without auth.** — Task 6 step adds `/api/registrations` to both proxy lists, verified by Task 6 test `unauthenticated decision is rejected`.
3. **Dropping a column a query still selects breaks at runtime, not compile time.** Drizzle table objects are typed but joins reach through relations. — Task 1 step runs `npm run build` after the drop; Task 2 removes the referencing code.
4. **Detail views 404 past the old silent row caps.** `getDocumentRequestView`, `getCertificateView`, `getStudentDetailView` scan capped lists in memory. — Task 11 test `detail view resolves a row past the 100-row cap`.
5. **The blockchain hash must be byte-identical for the same logical input.** A rename or reordering inside the canonical payload invalidates every past record. — Task 9 test `canonical document request payload is unchanged`.

---

## File Structure

**Create**
- `src/db/migrations/*` — Drizzle-generated migration for the drops and adds.
- `src/lib/services/registrations.ts` — create, list, and decide registrations.
- `src/lib/services/registrations.test.ts`
- `src/lib/services/live-data.test.ts` — counted pagination and detail-view resolution.
- `src/lib/services/document-types.ts` — CRUD ported out of `academic-setup.ts`.
- `src/lib/services/document-types.test.ts`
- `src/components/ui/pagination.tsx` — shared URL-bound pager.
- `src/components/registration-approve-actions.tsx` — approve/decline with note.
- `src/components/student-record-modal.tsx` — the View modal.
- `src/components/notification-detail-modal.tsx`
- `src/app/api/registrations/route.ts` — list pending.
- `src/app/api/registrations/[id]/decision/route.ts` — approve/decline.
- `src/app/api/notifications/[id]/details/route.ts`
- `src/app/(portal)/registrar/registrations/page.tsx`
- `src/app/(portal)/admin/registrations/page.tsx`
- `src/app/(portal)/admin/notifications/page.tsx`

**Modify**
- `src/db/schema.ts` — drops, `registrationStatusEnum`, `sectionNeeded`, notification refs.
- `src/lib/types.ts`, `src/lib/validators.ts`
- `src/app/api/auth/signup/route.ts`, `src/app/api/auth/login/route.ts`
- `src/lib/auth.ts`, `src/proxy.ts`, `src/lib/navigation.ts`
- `src/lib/services/live-data.ts`, `src/lib/services/certificates.ts`, `src/lib/services/document-requests.ts`, `src/lib/services/notifications.ts`
- `src/lib/email.ts`, `src/lib/notifications.ts`
- `src/app/(portal)/registrar/students/page.tsx`, `.../students/[id]/page.tsx`
- `src/app/(portal)/admin/document-types/page.tsx`
- `src/app/api/students/route.ts`, `src/app/api/students/[id]/route.ts`, `src/app/api/document-types/*`
- `src/components/request-form.tsx`, `src/components/student-record-form.tsx`, `src/components/profile-update-form.tsx`, `src/components/notifications-list.tsx`
- `scripts/seed.ts`, `scripts/bootstrap-admin.ts`, `scripts/check-migrations.ts`, `package.json`

**Delete**
- `src/lib/services/academic-setup.ts` (+ `.test.ts`), `src/lib/services/student-import.ts` (+ `.test.ts`)
- `src/app/api/academic-setup/**`, `src/app/api/students/import/**`
- `src/app/(portal)/admin/{academic-setup,school-years,grade-levels,sections}/page.tsx`
- `src/components/academic-setup-manager.tsx`, `src/components/academic-setup-delete-action.tsx`, `src/components/student-import-uploader.tsx`, `src/components/student-record-actions.tsx`
- `src/app/(portal)/registrar/students/import/page.tsx`

---

### Task 1: Schema migration — drops and adds

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/*` (via `npm run db:generate`)

**Interfaces:**
- Produces: `registrationStatusEnum` = `pgEnum("registration_status", ["pending", "approved", "declined"])`; `users.registrationStatus` (default `"pending"`); `documentRequests.sectionNeeded: varchar("section_needed", { length: 40 })`; `notifications.referenceType: varchar("reference_type", { length: 40 })`; `notifications.referenceId: varchar("reference_id", { length: 80 })`. Later tasks rely on these exact names.

- [ ] **Step 1: Edit `src/db/schema.ts`** — add the enum and columns above. Remove `schoolYears`, `gradeLevels`, `sections` tables and their relations. Remove `students.gradeLevelId`, `students.sectionId`, `students.schoolYearId`, `students.guardianName`, `students.guardianContact`, `students` relations to those tables, `certificates.schoolYearId`, and the `certificates` relation to `schoolYears`.

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: a new file under `drizzle/` containing the drops and adds.

- [ ] **Step 3: Add migration guard cases** in `scripts/check-migrations.ts` for the new migration tag so the destructive-delete gate sees the drops.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: compile errors from removed columns are listed — record them; Task 2 and Task 3 resolve them. It must not error on the schema file itself.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle scripts/check-migrations.ts
git commit -m "feat(db): add registration status and drop academic structure"
```

---

### Task 2: Remove the academic vertical

**Files:**
- Delete: `src/lib/services/academic-setup.ts`, `src/lib/services/academic-setup.test.ts`, `src/app/api/academic-setup/`, `src/app/(portal)/admin/{academic-setup,school-years,grade-levels,sections}/page.tsx`, `src/components/academic-setup-manager.tsx`, `src/components/academic-setup-delete-action.tsx`
- Modify: `src/lib/navigation.ts`, `src/proxy.ts`, `src/lib/services/portal-search.ts`, `src/lib/services/live-data.ts`, `src/lib/validators.ts`, `package.json`

**Interfaces:**
- Consumes: `documentTypeMutationSchema` from `src/lib/validators.ts` — keep it; Task 10 depends on it.
- Produces: `src/lib/validators.ts` exports no `schoolYearMutationSchema`, `gradeLevelMutationSchema`, or `sectionMutationSchema`. `src/lib/services/live-data.ts` exports no `listSchoolYearViews`, `listGradeLevelViews`, `listSectionViews`, or `getStudentRecordFormOptions`.

- [ ] **Step 1: Delete the files and routes listed above.**

- [ ] **Step 2: Remove the four admin nav links** (`Academic setup`, `School years`, `Grade levels`, `Sections`) from `navigationByRole.admin` in `src/lib/navigation.ts`.

- [ ] **Step 3: Remove `/api/academic-setup`** from `protectedPrefixes` and `config.matcher` in `src/proxy.ts`.

- [ ] **Step 4: Remove the sections result group** from admin search in `src/lib/services/portal-search.ts`, and the four deleted view functions from `src/lib/services/live-data.ts`.

- [ ] **Step 5: Remove the three mutation schemas** from `src/lib/validators.ts`, keeping `documentTypeMutationSchema`.

- [ ] **Step 6: Remove the deleted test files** from `test:unit` in `package.json`, and drop the stale `src/lib/services/email-triggers.test.ts` entry.

- [ ] **Step 7: Verify**

Run: `npm run build` then `npm run test:unit`
Expected: build passes; no test references a deleted module.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove academic setup vertical"
```

---

### Task 3: Remove guardian

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/validators.ts`, `src/lib/services/live-data.ts`, `src/components/profile-update-form.tsx`, `src/components/student-record-form.tsx`, `src/app/api/profile/route.ts`, `src/app/(portal)/student/profile/page.tsx`, `src/app/(portal)/registrar/students/[id]/page.tsx`

**Interfaces:**
- Produces: `StudentView` and student profile shapes carry no `guardianName` or `guardianContact`. `studentRecordSchema` has neither field.

- [ ] **Step 1: Remove `guardianName` and `guardianContact`** from `StudentView`, the student profile type, `studentRecordSchema`, and the `listStudentViews` / `getStudentDetailView` selects in `src/lib/services/live-data.ts`.

- [ ] **Step 2: Remove the guardian inputs** from `profile-update-form.tsx`, `student-record-form.tsx`, and the `guardianName` handling in `src/app/api/profile/route.ts`. Remove the "Contact & Guardian" card from `src/app/(portal)/student/profile/page.tsx`.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove guardian fields"
```

---

### Task 4: Signup creates both records, pending, with no session

**Files:**
- Modify: `src/app/api/auth/signup/route.ts`
- Create: `src/app/api/auth/signup/route.test.ts`
- Modify: `src/app/api/auth/login/route.ts`, `src/lib/auth.ts`

**Interfaces:**
- Consumes: `users.registrationStatus` from Task 1.
- Produces: `RegistrationStatus = "pending" | "approved" | "declined"` exported from `src/lib/types.ts`. A signup request body of `{ email, lrn, firstName, middleName, lastName, phone, address, password }`.

- [ ] **Step 1: Write the failing tests** in `src/app/api/auth/signup/route.test.ts`:

- `creates the user and student record and returns 201 without a session` — assert both rows exist, `registrationStatus === "pending"`, and no `Set-Cookie` for `lanhs_session`.
- `returns 409 when the LRN is already used` — body error is `"An account already uses that email or LRN."`
- `returns 409 when the email is already used` — same message.
- `persists middle name, phone, and address on the student record`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test src/app/api/auth/signup/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite `POST` in `src/app/api/auth/signup/route.ts`**

Schema becomes `{ email, lrn, firstName, middleName (optional), lastName, phone (optional), address (optional), password }`. Delete the `STUDENT_MATCH_FAILED` branch and the pre-existing-record lookup. Inside one transaction insert the `users` row with `role: "student"`, `registrationStatus: "pending"`, and the `students` row linked by `userId`, carrying `middleName`, `contactNumber: phone`, `address`, and `email`. Keep the duplicate check and the honest 409. Remove the `startSession` call. Keep hashing before the transaction.

- [ ] **Step 4: Gating in login and auth**

In `src/app/api/auth/login/route.ts`, keep the single generic 401 on line 40 for bad credentials; after `passwordOk` is true, branch: `registrationStatus === "pending"` returns 403 `"Your registration is still pending approval."`, `"declined"` returns 403 `"Your registration was declined. Contact the registrar."` Add the same `registrationStatus === "approved"` requirement in `src/lib/auth.ts`.

- [ ] **Step 5: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): self-registration creates pending student records"
```

---

### Task 5: Proxy gates on registration status

**Files:**
- Modify: `src/proxy.ts`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes: `users.registrationStatus` from Task 1.

- [ ] **Step 1: Write the failing test** in `src/proxy.test.ts`: `proxy blocks a pending user's token` — a signed session for a user with `registrationStatus: "pending"` gets a 401 on `/api/students`, and an `"approved"` user passes.

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test src/proxy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add `&& user.registrationStatus === "approved"`** to the session-valid condition on line 47 of `src/proxy.ts`.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts
git commit -m "feat(auth): proxy rejects pending and declined sessions"
```

---

### Task 6: Registration decision service and routes

**Files:**
- Create: `src/lib/services/registrations.ts`, `src/lib/services/registrations.test.ts`
- Create: `src/app/api/registrations/route.ts`, `src/app/api/registrations/[id]/decision/route.ts`
- Modify: `src/proxy.ts`, `src/lib/types.ts`, `src/lib/validators.ts`

**Interfaces:**
- Consumes: `users.registrationStatus`, `RegistrationStatus`.
- Produces:
  - `PendingRegistrationView = { id: string; name: string; email: string; lrn: string; createdAt: string }`
  - `listPendingRegistrations(): Promise<PendingRegistrationView[]>`
  - `decideRegistration(input: { id: string; decision: "approved" | "declined"; note: string; actorUserId: string; actorRole: string }): Promise<RegistrationStatus>`
  - `registrationDecisionSchema` in `src/lib/validators.ts` — `{ decision: z.enum(["approved","declined"]), note: z.string().trim().min(1, "A note is required.") }`
  - `GET /api/registrations` → `{ data: PendingRegistrationView[] }`
  - `POST /api/registrations/[id]/decision` → `{ data: { registrationStatus } }`

- [ ] **Step 1: Write the failing tests** in `src/lib/services/registrations.test.ts`:

- `approve sets registrationStatus to approved` and `decline sets registrationStatus to declined`.
- `decline without a note throws`.
- `a declined registration can later be approved`.
- `decision writes an audit log entry`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test src/lib/services/registrations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/services/registrations.ts`** with the signatures above. `decideRegistration` writes `registrationStatus`, records an audit entry via `src/lib/services/audit-log.ts`, and returns the new status.

- [ ] **Step 4: Add the routes** in `src/app/api/registrations/route.ts` (GET) and `src/app/api/registrations/[id]/decision/route.ts` (POST). Both must call `ensureCurrentDbUser()` and reject non-`registrar`/`admin` roles with 403.

- [ ] **Step 5: Register `/api/registrations`** in `protectedPrefixes` and `config.matcher` in `src/proxy.ts`.

- [ ] **Step 6: Write the failing test** `unauthenticated decision is rejected` — POST with no cookie returns 401. Run, confirm it fails, then confirm it passes after Step 5.

- [ ] **Step 7: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: registration approval service and routes"
```

---

### Task 7: Approval email and notification fan-out

**Files:**
- Modify: `src/lib/email.ts`, `src/lib/notifications.ts`, `src/lib/services/notifications.ts`
- Test: `src/lib/services/registrations.test.ts`

**Interfaces:**
- Consumes: `decideRegistration` from Task 6.
- Produces:
  - `sendRegistrationDecisionEmail(input: { to: string; studentName: string; decision: "approved" | "declined"; note: string }): Promise<{ ok: boolean; reason?: string }>`
  - `buildRegistrationDecisionNotification(studentName: string, decision: "approved" | "declined"): Pick<NewNotification, "type" | "title" | "message">` returning `type: "system"`, title `"Registration approved"` or `"Registration declined"`, message keyword-only.
  - `fanOutNewRegistrationNotification(name: string, email: string)` inserting for every registrar and admin, with `referenceType: "registration"`, `referenceId` the user id.

- [ ] **Step 1: Write the failing tests** in `src/lib/services/registrations.test.ts`:

- `decline sends an email to the registration address containing the note`.
- `approve sends an email to the registration address`.
- `new registration notifies every registrar and admin`.
- `a failed email send does not fail the decision`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test src/lib/services/registrations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the three functions** above. Email copy carries the outcome and the note. Wire them into `decideRegistration`, and call `fanOutNewRegistrationNotification` from signup in `src/app/api/auth/signup/route.ts`.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: approval email and registration notifications"
```

---

### Task 8: Pending registrations pages

**Files:**
- Create: `src/app/(portal)/registrar/registrations/page.tsx`, `src/app/(portal)/admin/registrations/page.tsx`, `src/components/registration-approve-actions.tsx`
- Modify: `src/lib/navigation.ts`

**Interfaces:**
- Consumes: `listPendingRegistrations`, `PendingRegistrationView`, `registrationDecisionSchema` from Task 6.
- Produces: nav items `Registrations` at `/registrar/registrations` and `/admin/registrations`.

- [ ] **Step 1: Build `RegistrationApproveActions`** — a client component with Approve and Decline buttons and a required note field, POSTing to `/api/registrations/[id]/decision`, then `router.refresh()`.

- [ ] **Step 2: Build both pages** showing `PendingRegistrationView` rows as **Name | Email | Approve | Decline | Note**, using `DataTable` and the actions component. Empty state: `"No registrations awaiting review."`

- [ ] **Step 3: Add nav items** to `registrar` and `admin` in `src/lib/navigation.ts`.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pending registrations pages"
```

---

### Task 9: Certificate wording from the request

**Files:**
- Modify: `src/lib/validators.ts`, `src/lib/services/certificates.ts`, `src/components/request-form.tsx`, `src/lib/services/document-requests.ts`, `src/lib/types.ts`
- Test: `src/lib/audit/canonical.test.ts`, `src/lib/services/certificate-edit-view.test.ts`

**Interfaces:**
- Consumes: `documentRequests.sectionNeeded` from Task 1.
- Produces: `documentRequestSchema` requires `sectionNeeded`; `certificateGenerateSchema` drops `schoolYearId` and `requestId` becomes required.

- [ ] **Step 1: Write the failing tests**:

- `canonical document request payload is unchanged` in `src/lib/audit/canonical.test.ts` — assert `buildCanonicalDocumentRequest` returns exactly the fields `trackingNumber`, `documentType`, `status`, `schoolYearNeeded`, `gradeLevelNeeded` and nothing else.
- `certificate text includes grade level, section, and school year from the request` in `src/lib/services/certificate-edit-view.test.ts`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test src/lib/audit/canonical.test.ts src/lib/services/certificate-edit-view.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the `Section` input** to `src/components/request-form.tsx` beside School year and Grade level, and add `sectionNeeded` to `documentRequestSchema` and the insert in `src/lib/services/document-requests.ts`.

- [ ] **Step 4: Repoint certificate generation** — in `src/lib/services/certificates.ts`, replace the four `schoolYears` lookups with `request?.schoolYearNeeded ?? ""`, and source grade level and section from `request.gradeLevelNeeded` / `request.sectionNeeded`. Remove `schoolYearId` from `certificateGenerateSchema` and require `requestId`. Leave `src/lib/audit/canonical.ts` untouched.

- [ ] **Step 5: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: certificates source class details from the request"
```

---

### Task 10: Document types CRUD

**Files:**
- Create: `src/lib/services/document-types.ts`, `src/lib/services/document-types.test.ts`
- Create: `src/app/api/document-types/route.ts`, `src/app/api/document-types/[id]/route.ts`
- Modify: `src/app/(portal)/admin/document-types/page.tsx`, `src/proxy.ts`

**Interfaces:**
- Consumes: `documentTypeMutationSchema` from `src/lib/validators.ts`.
- Produces:
  - `createDocumentType(input): Promise<DocumentTypeView>`, `updateDocumentType(id, input): Promise<DocumentTypeView>`, `deactivateDocumentType(id): Promise<void>`
  - `GET/POST /api/document-types`, `PATCH /api/document-types/[id]`

- [ ] **Step 1: Write the failing tests** in `src/lib/services/document-types.test.ts`: `create adds a document type`, `update edits name and processing days`, `deactivate sets isActive false and keeps the row`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --import tsx --test src/lib/services/document-types.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/services/document-types.ts`** by porting the CRUD out of the deleted `academic-setup.ts`, replacing hard delete with `isActive = false`.

- [ ] **Step 4: Add the routes** and register `/api/document-types` in `protectedPrefixes` and `config.matcher`. Rebuild `/admin/document-types` as a table with inline edit, an add form, and a Deactivate action.

- [ ] **Step 5: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: document type management"
```

---

### Task 11: Student records page and View modal

**Files:**
- Modify: `src/app/(portal)/registrar/students/page.tsx`, `src/app/(portal)/registrar/students/[id]/page.tsx`, `src/lib/services/live-data.ts`, `src/app/api/students/[id]/route.ts`
- Create: `src/components/student-record-modal.tsx`
- Delete: `src/components/student-record-form.tsx`, `src/components/student-record-actions.tsx`, `src/app/(portal)/registrar/students/import/`, `src/app/api/students/import/`, `src/lib/services/student-import.ts`, `src/lib/services/student-import.test.ts`, `src/components/student-import-uploader.tsx`
- Modify: `src/lib/navigation.ts`, `src/proxy.ts`, `src/lib/services/certificates.ts`, `src/lib/services/live-data.ts`, `package.json`

**Interfaces:**
- Consumes: `StudentView`, `registrationStatus`.
- Produces: `StudentView` gains `email: string` and `phone: string`; `getDocumentRequestView(id)`, `getCertificateView(id)`, `getStudentDetailView(id)` become indexed single-row queries.

- [ ] **Step 1: Write the failing test** `detail view resolves a row past the 100-row cap` — seed more rows than the old `.limit(100)` and assert `getDocumentRequestView` still resolves one beyond it.

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test src/lib/services/live-data.test.ts`
Expected: FAIL.

- [ ] **Step 3: Delete the add form, import page, import routes, and import service** listed above. Remove `Student records` add/import affordances and the `Import students` nav item.

- [ ] **Step 4: Convert the three detail views** in `src/lib/services/live-data.ts` and `src/lib/services/certificates.ts` to indexed `WHERE` queries instead of in-memory scans over capped lists.

- [ ] **Step 5: Rebuild the list** as **LRN | Name | Email | Phone | Account | Status | View**, with `email` from `students.email` falling back to the linked user's, `phone` from `students.contactNumber`, `Account` showing `Approved`/`Pending`/`Declined`. Add `email` and `phone` to `StudentView`.

- [ ] **Step 6: Build `StudentRecordModal`** — a single View button per row opening a modal where LRN, names, email, phone, address, and status are editable in place, with **Save**, **Cancel**, and **Delete**. Delete is disabled when requests or certificates are linked, removes only the `students` row, and its confirm text states the account survives.

- [ ] **Step 7: Run tests**

Run: `npm run test:unit` then `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: student records view modal and pagination-safe detail views"
```

---

### Task 12: Clickable notifications

**Files:**
- Modify: `src/lib/services/notifications.ts`, `src/lib/services/certificates.ts`, `src/lib/services/document-requests.ts`, `src/components/notifications-list.tsx`, `src/lib/types.ts`
- Create: `src/app/api/notifications/[id]/details/route.ts`, `src/components/notification-detail-modal.tsx`, `src/app/(portal)/admin/notifications/page.tsx`
- Modify: `src/lib/navigation.ts`

**Interfaces:**
- Consumes: `notifications.referenceType`, `notifications.referenceId` from Task 1.
- Produces: `getNotificationDetail(userId, notificationId): Promise<{ kind: "request" | "certificate" | "registration" | "message"; record: unknown }>`.

- [ ] **Step 1: Write the failing test** `notification detail resolves the referenced record` and `a notification with no reference returns a message-only detail`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test src/lib/services/notifications.test.ts`
Expected: FAIL.

- [ ] **Step 3: Populate `referenceType` and `referenceId`** at every notification insert: `src/lib/services/certificates.ts`, `src/lib/services/document-requests.ts`, `src/lib/services/notifications.ts`. Convert message text to keyword-only form `<type keyword> · <status keyword>`.

- [ ] **Step 4: Add `GET /api/notifications/[id]/details`** returning `getNotificationDetail`, and register `/api/notifications` in the proxy lists.

- [ ] **Step 5: Make `NotificationsList` open `NotificationDetailModal` on click**, marking read as it does today. Pre-migration rows with no reference open a message-only modal.

- [ ] **Step 6: Add `/admin/notifications`** mirroring the registrar page, and a Notifications nav item for `admin`.

- [ ] **Step 7: Run tests**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: clickable notifications with detail modal"
```

---

### Task 13: Pagination

**Files:**
- Create: `src/components/ui/pagination.tsx`
- Modify: `src/lib/services/live-data.ts`, `src/lib/services/certificates.ts`, `src/lib/services/reports.ts`, `src/lib/services/portal-search.ts`, and the list pages

**Interfaces:**
- Produces: `Paged<T> = { rows: T[]; total: number; page: number; pageSize: number }`, `PAGE_SIZE = 20`, and `Pagination({ page, totalPages, basePath, total, pageSize })` rendering links for `?page=N`.

- [ ] **Step 1: Write the failing test** `list returns a total count and a page slice` — assert a list of 45 rows at `page: 3, pageSize: 20` returns 5 rows and `total: 45`.

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test src/lib/services/live-data.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add counted pagination** — `listAuditTrailViews`, `listUserViews`, `listStudentViews`, `listCertificateViews`, `listDocumentRequestViews`, `listUserNotifications`, and `listReports` take `{ page, pageSize }` and return `Paged<T>`, replacing the bare `.limit(50)` / `.limit(100)`.

- [ ] **Step 4: Paginate each search group independently** in `src/lib/services/portal-search.ts`, each with its own page param and total.

- [ ] **Step 5: Build `Pagination`** and render it on: audit logs, blockchain trail, users, student records, certificates, requests (registrar and student), notifications, reports, search results.

- [ ] **Step 6: Run tests**

Run: `npm run test:unit` then `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: pagination across list pages"
```

---

### Task 14: Seed, bootstrap, and test cleanup

**Files:**
- Modify: `scripts/seed.ts`, `scripts/bootstrap-admin.ts`, `package.json`

**Interfaces:**
- Consumes: `users.registrationStatus`, `documentTypes` from Task 10.

- [ ] **Step 1: Rewrite `scripts/seed.ts`** to create document types, staff users with `registrationStatus: "approved"`, and one approved student — with no school years, grade levels, sections, or guardian.

- [ ] **Step 2: Set `registrationStatus: "approved"`** in `scripts/bootstrap-admin.ts`.

- [ ] **Step 3: Reconcile `test:unit`** in `package.json` against the files that still exist.

- [ ] **Step 4: Verify**

Run: `npm run db:seed` then `npm run test:unit` then `npm run lint` then `npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: rewrite seed and bootstrap for registration approval"
```

---

### Task 15: Delivery

- [ ] **Step 1: Confirm the branch is clean and green**

Run: `git status` then `npm run test:unit`
Expected: clean tree, all tests pass.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Merge to `main` for production** — open the PR and merge it. Confirm with the human partner before the merge lands, since this deploys to production.
