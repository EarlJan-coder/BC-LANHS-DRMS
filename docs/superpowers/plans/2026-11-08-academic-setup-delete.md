# Academic Setup Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can delete a school year, grade level, section, or document type from the admin portal — unused records delete cleanly; in-use records refuse with a counted message telling them to deactivate instead.

**Architecture:** Four guarded delete functions in the existing `academic-setup` service (mirror `deleteStudentRecord`), a `DELETE` handler in the existing `[entity]/[id]` route that also writes the audit log, and a self-contained delete action component (trash button + confirm dialog) wired into each row of `academic-setup-manager.tsx`. No schema changes; no migrations.

**Tech Stack:** Next.js 16 route handlers, Drizzle/Postgres, `node:test` integration tests, existing `ConfirmDialog`/`Button`/`sonner` components.

**Spec:** Design agreed in conversation on 2026-11-08 (no separate design doc): delete only when unused; refuse with counted message + remedy when referenced; never cascade; hard delete; audit-log every deletion.

## Global Constraints

- Hard delete only; never cascade, never soft-delete. In-use ⇒ `AcademicSetupError(…, 409)`.
- Guard messages include counts and the remedy, pluralized: e.g. `This school year has 3 sections, 12 students, and 3 certificates linked to it. Close it instead.` (school year ⇒ "Close it instead."; the other three ⇒ "Deactivate it instead.")
- Missing row ⇒ 404 with the same wording style as the update functions (`"School year not found."`).
- Every delete is audit-logged via `recordAuditedAction` (action `"academic_setup.delete"`), like the users routes do.

## Review Focus

1. **Delete button lives inside each row's save `<form>`** — it and the dialog must never trigger the row's save submit. (Pinned by manual verification in Task 3; `ConfirmDialog` buttons already verified `type="button"`.)
2. **Every referencing table is counted before delete** — a missed reference surfaces as a raw FK violation 500 instead of the friendly 409. `certificates.school_year_id` is the easy one to miss. (Pinned by Task 1 tests, one per entity.)
3. **Guard message grammar** — "1 sections" or an empty list leaking into the message. (Pinned by Task 1 assertions on message text.)
4. **Audit write happens after the delete** and is awaited, mirroring the users route: if the audit insert itself failed, the route returns 500 although the row is gone. Accepting that non-atomicity for consistency — flag if you disagree.
5. **Race between guard check and delete** — a reference added in that window hits the FK constraint and returns a 500 rather than the friendly 409. Acceptable backstop; no locking.

---

### Task 1: Guarded delete services (+ tests)

**Files:**
- Modify: `src/lib/services/academic-setup.ts`
- Create: `src/lib/services/academic-setup.test.ts`
- Modify: `package.json` (add the test to `test:unit`)

**Interfaces:**
- Consumes: existing `AcademicSetupError`, `getDb`, schema tables.
- Produces (consumed by Task 2): `deleteSchoolYear(id: string)`, `deleteGradeLevel(id: string)`, `deleteSection(id: string)`, `deleteDocumentType(id: string)` — each returns the deleted row via `.returning()`; throws `AcademicSetupError` 409 when linked, 404 when missing.

Guards (counts → message subjects):
- `deleteSchoolYear`: `sections.schoolYearId`, `students.schoolYearId`, `certificates.schoolYearId` ⇒ "3 sections, 12 students, and 3 certificates … Close it instead."
- `deleteGradeLevel`: `sections.gradeLevelId`, `students.gradeLevelId` ⇒ "Deactivate it instead."
- `deleteSection`: `students.sectionId` ⇒ "Deactivate it instead."
- `deleteDocumentType`: `documentRequests.documentTypeId` ⇒ "Deactivate it instead."

Plus one private `formatLinkCounts` helper (pluralize + "a, b, and c" join) shared by all four.

- [ ] **Step 1: Write failing tests** in `src/lib/services/academic-setup.test.ts`, following `account-admin.test.ts` conventions exactly (dynamic imports after env load, `hasDb` skip, `RUN_TAG` fixture names, best-effort cleanup with `console.warn`, `closeDb` in `after`):
  - unused row deletes successfully and is gone — one test per entity
  - linked row refuses with status 409 and a message containing the counted links and the right remedy — one test per entity (school year: link a student *and* a certificate; grade level: link a section; section: link a student; document type: link a document request — `documentRequests` needs only `trackingNumber` + `purpose` + the FK)
  - `deleteSchoolYear("nonexistent")` rejects with status 404 / "School year not found."
  - a 1-link case asserting singular form ("1 student")
- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/services/academic-setup.test.ts`
Expected: FAIL (delete functions not defined)

- [ ] **Step 3: Implement the four `deleteX(id)` functions + `formatLinkCounts`** in `src/lib/services/academic-setup.ts`, following the `updateX` error style and the guard-first shape of `deleteStudentRecord`.
- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/services/academic-setup.test.ts`
Expected: PASS

- [ ] **Step 5:** Add the test file to `package.json`'s `test:unit` list and run `npm run test:unit` — full suite green.
- [ ] **Step 6: Commit**

```bash
git add src/lib/services/academic-setup.ts src/lib/services/academic-setup.test.ts package.json
git commit -m "feat: add guarded delete for academic setup entities"
```

### Task 2: DELETE route + audit log

**Files:**
- Modify: `src/app/api/academic-setup/[entity]/[id]/route.ts` (add `DELETE` beside `PATCH`)

**Interfaces:**
- Consumes: the four `deleteX` functions from Task 1.
- Produces: `DELETE /api/academic-setup/<entity>/<id>` → `{ data }` on success, error JSON via the existing `handleError`.

- [ ] **Step 1: Add `DELETE` handler**: `assertAcademicSetupAccess()` (keep its returned role) → `getCurrentDbUser()` → dispatch per `entity` exactly like `PATCH` does → `await recordAuditedAction({ action: "academic_setup.delete", actorRole: role, actorUserId: user?.id, entityType, entityId: id, referenceId: id, metadata: { name: data.name } })` where `entityType` maps `school-years → school_year`, `grade-levels → grade_level`, `sections → section`, `document-types → document_type` → `NextResponse.json({ data })`.
- [ ] **Step 2: Verify** `npm run lint` and `npm run build` pass. (Thin dispatcher — covered by Task 1's service tests, matching how `students/[id]` is tested.)
- [ ] **Step 3: Commit**

```bash
git add "src/app/api/academic-setup/[entity]/[id]/route.ts"
git commit -m "feat: add DELETE endpoint for academic setup entities"
```

### Task 3: Delete button + confirm dialog in the admin portal

**Files:**
- Create: `src/components/academic-setup-delete-action.tsx`
- Modify: `src/components/academic-setup-manager.tsx` (4 row action cells)

**Interfaces:**
- Consumes: `DELETE /api/academic-setup/<entity>/<id>`.
- Produces: `DeleteSetupAction({ entity, id, name })`, and `export type AcademicSetupEntity` (the existing local `Entity` type in the manager aliases it).

- [ ] **Step 1: Build `DeleteSetupAction`** mirroring `student-record-actions.tsx`'s delete flow: danger `Button` (`type="button"`, `Trash2` icon, `aria-label={`Delete ${name}`}`, loading/disabled while in flight) → `ConfirmDialog` (`tone="danger"`, `confirmLabel="Delete"`) → `fetch(DELETE)` → toast success `"School year deleted."` (per entity noun) or `toast.error(data.error ?? "Unable to delete …")` → `router.refresh()`.
  - Dialog copy per entity, matching the guard: e.g. title `"Delete this school year?"`, message `"This can't be undone. School years with linked sections, students, or certificates cannot be deleted."`
- [ ] **Step 2: Wire into `academic-setup-manager.tsx`**: in each of the 4 row forms, wrap the Save button and `DeleteSetupAction` in `<div className="flex items-center gap-2">` in the existing `auto` grid column.
- [ ] **Step 3: Verify manually** on `npm run dev` → `/admin/academic-setup`: delete an unused row (it disappears, toast fires), attempt an in-use row (409 message shown as toast, row stays), click Save on a row after opening/closing its delete dialog (form doesn't misfire).
- [ ] **Step 4: Final gate** — `npm run test:unit`, `npm run lint`, `npm run build` all green.
- [ ] **Step 5: Commit**

```bash
git add src/components/academic-setup-delete-action.tsx src/components/academic-setup-manager.tsx
git commit -m "feat: add delete actions to academic setup manager"
```
