# Admin Account Creation + Forced Password Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create staff accounts and reset passwords with a placeholder that must be replaced at first login, and let any user change their own password in the portal.

**Architecture:** A `mustChangePassword` flag on `users` is the single signal. `src/proxy.ts` — which already gates every protected route — reads it and redirects to a shared `/change-password` screen until it clears. Account mutation logic lives in a new `src/lib/services/account-admin.ts` with the same service-plus-`*.test.ts` shape as the rest of `src/lib/services/`.

**Tech Stack:** Next.js 16.2.7 (App Router, Turbopack), React 19.2.4, Drizzle ORM + PostgreSQL, zod, bcryptjs (cost 12), jose. Tests via `node --import tsx --test`.

**Spec:** `docs/superpowers/specs/2026-10-27-admin-account-creation-and-password-change-design.md`

## Global Constraints

- Staff account creation accepts **only** `"alumni" | "registrar" | "admin"`. Never `"student"` — that would break the `students.userId` invariant every student dashboard query depends on.
- Passwords: 8–72 characters, hashed with `bcrypt.hash(password, 12)`. A password over 72 **bytes** is rejected before hashing.
- Every admin-set password (create *and* reset) sets `mustChangePassword = true`. Self-service change clears it.
- Create and reset bump `users.tokenVersion` so outstanding cookies are revoked. Self-service change bumps it **and** re-issues the caller's session so they stay signed in.
- All three operations call `recordAuditedAction`. Never log the password or its hash.
- `AppError` is constructed **message-first**: `new AppError("message", 400)`. (`src/lib/utils.ts:50`)
- `ensureCurrentDbUser()` returns `null` when unauthenticated — it does **not** throw. (`src/lib/auth.ts:32`)
- New test files must be added to the `test:unit` script in `package.json` or they will never run.
- `npm run build` runs the TypeScript check; it must stay green.

## Review Focus

1. **A user holding `mustChangePassword` reaches a protected page.** Expected: redirected to `/change-password`, not shown the page. → Task 4, `src/proxy.test.ts`.
2. **`POST /api/users` with `role: "student"`.** Expected: rejected at the schema boundary with 400, never reaching an insert. → Task 1, `account-admin.test.ts`.
3. **A password is changed or reset while an old cookie is still live.** Expected: that cookie stops working on the next request. → Tasks 2 and 3, `account-admin.test.ts`.
4. **Change password with a wrong current password.** Expected: 401 and the stored hash is untouched. → Task 3, `account-admin.test.ts`.
5. **A non-admin calls `POST /api/users` or the reset route.** Expected: 403 before any database write. → Task 1, `assertAdmin allows an admin and throws 403 for every other role` (both admin routes delegate to `assertAdmin`, so this one test is the gate).

---

### Task 1: `mustChangePassword` schema + staff account creation

**Files:**
- Modify: `src/db/schema.ts:41-57` (the `users` table)
- Modify: `src/lib/validators.ts` (append after `userRoleUpdateSchema`, line 62)
- Modify: `src/lib/auth-rate-limit.ts:18` (`AuthRateLimitAction`)
- Create: `src/lib/services/account-admin.ts`
- Create: `src/app/api/users/route.ts`
- Test: `src/lib/services/account-admin.test.ts`
- Modify: `package.json` (`test:unit` script)

**Interfaces:**
- Consumes: `AppError(message, status)` from `@/lib/utils`; `checkAuthRateLimit(request, identifier, action)` from `@/lib/auth-rate-limit`; `recordAuditedAction(input)` from `@/lib/services/audit-log`; `getCurrentDbUser()` from `@/lib/auth`.
- Produces (later tasks depend on these exact names):
  - `createStaffAccount(input: { email: string; firstName: string; lastName: string; role: "alumni" | "registrar" | "admin"; password: string }): Promise<{ id: string; email: string; role: UserRole }>`
  - `assertAdmin(actor: { role: UserRole }): void` — throws `AppError(403)` when `actor.role !== "admin"`. Both admin routes call this, and it is the unit that carries Review Focus #5, since route handlers are not covered by this repo's test suite.
  - `users.mustChangePassword: boolean` — column name `must_change_password`, default `false`
  - `userCreateSchema` in `@/lib/validators`

- [ ] **Step 1: Write the failing tests**

In `src/lib/services/account-admin.test.ts`, following the fixture style of `src/lib/services/notifications.test.ts` (real local DB, cleanup at the end):

```ts
test("createStaffAccount sets mustChangePassword and leaves the LRN empty", async () => {
  const created = await createStaffAccount({ email: "reg@example.com", firstName: "Rina", lastName: "Reyes", role: "registrar", password: "placeholder123" });
  const row = await db.query.users.findFirst({ where: eq(users.id, created.id) });
  assert.equal(row.mustChangePassword, true);
  assert.equal(row.lrn, null);
  assert.equal(row.role, "registrar");
});

test("createStaffAccount rejects a duplicate email with a 409", async () => {
  await createStaffAccount({ email: "dup@example.com", firstName: "A", lastName: "B", role: "admin", password: "placeholder123" });
  await assert.rejects(
    () => createStaffAccount({ email: "dup@example.com", firstName: "C", lastName: "D", role: "alumni", password: "placeholder123" }),
    (error: AppError) => error.status === 409,
  );
});

test("createStaffAccount rejects the student role at the schema boundary", () => {
  assert.throws(() => userCreateSchema.parse({ email: "s@example.com", firstName: "S", lastName: "T", role: "student", password: "placeholder123" }));
});

test("createStaffAccount hashes the password and never stores it", async () => {
  const created = await createStaffAccount({ email: "hash@example.com", firstName: "H", lastName: "I", role: "alumni", password: "placeholder123" });
  const row = await db.query.users.findFirst({ where: eq(users.id, created.id) });
  assert.notEqual(row.passwordHash, "placeholder123");
  assert.ok(row.passwordHash.startsWith("$2"));
});

test("assertAdmin allows an admin and throws 403 for every other role", () => {
  assert.doesNotThrow(() => assertAdmin({ role: "admin" }));
  for (const role of ["student", "alumni", "registrar"] as const) {
    assert.throws(() => assertAdmin({ role }), (e: AppError) => e.status === 403);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/lib/services/account-admin.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/account-admin'` / `userCreateSchema is not defined`.

- [ ] **Step 3: Add the column and the schema**

In `src/db/schema.ts`, inside the `users` table definition after `tokenVersion` (line 54):

```ts
mustChangePassword: boolean("must_change_password").notNull().default(false),
```

In `src/lib/validators.ts`, after `userRoleUpdateSchema`:

```ts
export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(191),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  role: z.enum(["alumni", "registrar", "admin"]),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});
```

In `src/lib/auth-rate-limit.ts:18` widen the action union so the admin endpoints share the existing bucket machinery:

```ts
export type AuthRateLimitAction = "login" | "signup" | "admin-account";
```

Then generate the migration — do not hand-write the SQL:

Run: `npm run db:generate`
Expected: a new `drizzle/00XX_*.sql` containing `ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;`

- [ ] **Step 4: Implement `createStaffAccount` in `src/lib/services/account-admin.ts`**

```ts
export async function createStaffAccount(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: "alumni" | "registrar" | "admin";
  password: string;
}): Promise<{ id: string; email: string; role: UserRole }>
```

Body: reject a duplicate email with `new AppError("An account already uses that email.", 409)` before hashing (bcrypt is ~0.5s at cost 12 — do not spend it on an attempt that will be rejected); then `bcrypt.hash(input.password, 12)`; insert with `mustChangePassword: true`, `tokenVersion: 0`, `status: "active"`, `isActive: true`, and **no** `lrn`. Map a Postgres `23505` unique violation to the same 409.

Also in this file:

```ts
export function assertAdmin(actor: { role: UserRole }): void
```

Throws `new AppError("Only administrators can manage accounts.", 403)` unless `actor.role === "admin"`. Keep it here rather than inline in the routes so the authorization rule is testable — this repo's suite covers services, not route handlers.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test src/lib/services/account-admin.test.ts`
Expected: PASS for all five.

- [ ] **Step 6: Add `POST /api/users` in `src/app/api/users/route.ts`**

Handler `export async function POST(request: Request)`. Order matters:

1. `const user = await getCurrentDbUser(); if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });`
2. `assertAdmin(user);` — returns 403 via `AppError` for any non-admin, before any database write.
3. Parse `userCreateSchema`; on `ZodError` return `error.issues[0]?.message` with 400.
4. `checkAuthRateLimit(request, values.email, "admin-account")`; if `!allowed`, return 429 with `Retry-After`.
5. `createStaffAccount(values)`.
6. `recordAuditedAction({ action: "user.create", actorRole: "admin", entityType: "user", entityId: created.id, actorUserId: user.id, referenceId: created.id, metadata: { email: created.email, role: created.role } })` — never the password.
7. Return `NextResponse.json({ ok: true, user: created }, { status: 201 })`.

- [ ] **Step 7: Register the test file and run the full suite**

Add `src/lib/services/account-admin.test.ts` to the `test:unit` script in `package.json`.
Run: `npm run test:unit` then `npm run build`
Expected: all tests pass; TypeScript clean.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/lib/validators.ts src/lib/auth-rate-limit.ts src/lib/services/account-admin.ts src/lib/services/account-admin.test.ts src/app/api/users/route.ts package.json drizzle/
git commit -m "feat: admin staff account creation with must-change-password flag"
```

---

### Task 2: Admin password reset

**Files:**
- Create: `src/app/api/users/[id]/reset-password/route.ts`
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/services/account-admin.ts`
- Test: `src/lib/services/account-admin.test.ts`

**Interfaces:**
- Consumes: `createStaffAccount` fixture helpers from Task 1; `AppError(message, status)`; `recordAuditedAction`.
- Produces: `resetUserPassword(userId: string, password: string): Promise<{ id: string }>`; `userPasswordResetSchema`.

- [ ] **Step 1: Write the failing tests**

```ts
test("resetUserPassword replaces the hash and re-arms mustChangePassword", async () => {
  const created = await createStaffAccount({ email: "reset@example.com", firstName: "R", lastName: "S", role: "registrar", password: "placeholder123" });
  await db.update(users).set({ mustChangePassword: false }).where(eq(users.id, created.id));
  await resetUserPassword(created.id, "newplaceholder456");
  const row = await db.query.users.findFirst({ where: eq(users.id, created.id) });
  assert.equal(row.mustChangePassword, true);
  assert.ok(await comparePassword("newplaceholder456", row.passwordHash));
  assert.ok(!(await comparePassword("placeholder123", row.passwordHash)));
});

test("resetUserPassword bumps tokenVersion so outstanding cookies are revoked", async () => {
  const created = await createStaffAccount({ email: "rev@example.com", firstName: "R", lastName: "V", role: "alumni", password: "placeholder123" });
  const before = (await db.query.users.findFirst({ where: eq(users.id, created.id) })).tokenVersion;
  await resetUserPassword(created.id, "newplaceholder456");
  const after = (await db.query.users.findFirst({ where: eq(users.id, created.id) })).tokenVersion;
  assert.equal(after, before + 1);
});

test("resetUserPassword throws 404 for an unknown user", async () => {
  await assert.rejects(() => resetUserPassword("00000000-0000-4000-8000-000000000000", "placeholder123"), (e: AppError) => e.status === 404);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/lib/services/account-admin.test.ts`
Expected: FAIL — `resetUserPassword is not a function`.

- [ ] **Step 3: Implement `resetUserPassword` and `userPasswordResetSchema`**

```ts
export async function resetUserPassword(userId: string, password: string): Promise<{ id: string }>
```

Add to `src/lib/validators.ts`:

```ts
export const userPasswordResetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});
```

Body: load the user; `new AppError("Account not found.", 404)` if absent; reject a >72-byte password before hashing; hash at cost 12; update `passwordHash`, `mustChangePassword: true`, `tokenVersion` incremented by 1, `updatedAt: new Date()`. Return `{ id }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/lib/services/account-admin.test.ts`
Expected: PASS for all eight.

- [ ] **Step 5: Add `POST /api/users/[id]/reset-password`**

Handler `export async function POST(request: Request, { params }: { params: Promise<{ id: string }> })` — note `params` is a **Promise** in Next 16 and must be awaited.

Same guard order as Task 1 Step 6: 401 unauthenticated, `assertAdmin(user)`, parse `userPasswordResetSchema` (400), `checkAuthRateLimit(request, id, "admin-account")` (429), then `resetUserPassword(id, values.password)`, then `recordAuditedAction({ action: "user.password_reset", actorRole: "admin", entityType: "user", entityId: id, actorUserId: user.id, referenceId: id, metadata: { email: target.email } })`. Return `{ ok: true }`.

- [ ] **Step 6: Run the full suite and build**

Run: `npm run test:unit` then `npm run build`
Expected: green, TypeScript clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/users/[id]/reset-password/route.ts src/lib/validators.ts src/lib/services/account-admin.ts src/lib/services/account-admin.test.ts
git commit -m "feat: admin password reset that re-arms must-change-password"
```

---

### Task 3: Self-service password change

**Files:**
- Create: `src/app/api/profile/password/route.ts`
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/services/account-admin.ts`
- Test: `src/lib/services/account-admin.test.ts`

**Interfaces:**
- Consumes: `AppError`, `comparePassword` from `@/lib/password`, `startSession(userId, tokenVersion)` from `@/lib/session`.
- Produces: `changeOwnPassword(userId, currentPassword, newPassword): Promise<{ tokenVersion: number }>`; `passwordChangeSchema`.

- [ ] **Step 1: Write the failing tests**

```ts
test("changeOwnPassword rejects a wrong current password with 401", async () => {
  const created = await createStaffAccount({ email: "self@example.com", firstName: "S", lastName: "E", role: "alumni", password: "placeholder123" });
  await assert.rejects(() => changeOwnPassword(created.id, "not-the-password", "brandnew12345"), (e: AppError) => e.status === 401);
  const row = await db.query.users.findFirst({ where: eq(users.id, created.id) });
  assert.ok(await comparePassword("placeholder123", row.passwordHash));
});

test("changeOwnPassword clears mustChangePassword and returns the bumped tokenVersion", async () => {
  const created = await createStaffAccount({ email: "done@example.com", firstName: "D", lastName: "O", role: "registrar", password: "placeholder123" });
  const result = await changeOwnPassword(created.id, "placeholder123", "brandnew12345");
  const row = await db.query.users.findFirst({ where: eq(users.id, created.id) });
  assert.equal(row.mustChangePassword, false);
  assert.equal(result.tokenVersion, row.tokenVersion);
  assert.ok(result.tokenVersion > 0);
});

test("changeOwnPassword rejects a short new password", () => {
  assert.throws(() => passwordChangeSchema.parse({ currentPassword: "placeholder123", newPassword: "short" }));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/lib/services/account-admin.test.ts`
Expected: FAIL — `changeOwnPassword is not a function`.

- [ ] **Step 3: Implement `changeOwnPassword` and `passwordChangeSchema`**

```ts
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ tokenVersion: number }>
```

Add to `src/lib/validators.ts`:

```ts
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(72),
  newPassword: z.string().min(8, "Password must be at least 8 characters.").max(72),
});
```

Body: load the user (`new AppError("Account not found.", 404)` if absent); `comparePassword(currentPassword, user.passwordHash)` and on failure `new AppError("Your current password is incorrect.", 401)` **before** hashing the new one; reject a >72-byte new password; hash at cost 12; set `passwordHash`, `mustChangePassword: false`, `tokenVersion` + 1. Return the new `tokenVersion` so the route can re-issue the caller's session.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/lib/services/account-admin.test.ts`
Expected: PASS for all eleven.

- [ ] **Step 5: Add `PATCH /api/profile/password`**

Handler `export async function PATCH(request: Request)` in `src/app/api/profile/password/route.ts`. `const user = await getCurrentDbUser(); if (!user) return 401`. Parse `passwordChangeSchema` (400). `checkAuthRateLimit(request, user.email, "admin-account")` (429) so the endpoint cannot be used to brute-force a stolen session. `const { tokenVersion } = await changeOwnPassword(...)` then `await startSession(user.id, tokenVersion)` — this is what keeps the caller signed in while revoking every other device. `recordAuditedAction({ action: "user.password_change", actorRole: user.role, entityType: "user", entityId: user.id, actorUserId: user.id, referenceId: user.id })`. Return `{ ok: true }`.

- [ ] **Step 6: Run the full suite and build**

Run: `npm run test:unit` then `npm run build`
Expected: green, TypeScript clean.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/profile/password/route.ts src/lib/validators.ts src/lib/services/account-admin.ts src/lib/services/account-admin.test.ts
git commit -m "feat: self-service password change with session re-issue"
```

---

### Task 4: Enforce `mustChangePassword` in the proxy

**Files:**
- Modify: `src/proxy.ts:7-25` and `src/proxy.ts:27-62`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes: `users.mustChangePassword` from Task 1.
- Produces: routing behaviour only — no new exports.

- [ ] **Step 1: Write the failing tests**

In `src/proxy.test.ts`, matching the existing fixture style:

```ts
test("redirects a user with mustChangePassword to /change-password", ...)
// seed a user with mustChangePassword: true, request /student/dashboard
// expect a redirect whose Location ends with /change-password

test("allows /change-password and /api/profile/password while the flag is set", ...)
// both requests must return NextResponse.next(), not a redirect

test("does not redirect a user without the flag", ...)
// mustChangePassword: false on /student/dashboard -> NextResponse.next()

test("returns 403 for other API routes while the flag is set", ...)
// request /api/profile with the flag set -> 403 JSON
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/proxy.test.ts`
Expected: FAIL — the redirect does not happen yet.

- [ ] **Step 3: Implement the gate in `src/proxy.ts`**

Add `/change-password` to `protectedPrefixes` (line 7) and `"/change-password"` to `config.matcher` (line 65) — the page needs a session to know whose password is being changed.

Add near the top:

```ts
const passwordChangeAllowlist = ["/change-password", "/api/profile/password", "/api/auth/logout"];
```

Inside the existing `if (user && user.isActive && ...)` branch, before `return NextResponse.next()`:

```ts
if (user.mustChangePassword && !passwordChangeAllowlist.includes(request.nextUrl.pathname)) {
  return request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Change your password before continuing." }, { status: 403 })
    : NextResponse.redirect(new URL("/change-password", request.url));
}
```

Note `isProtectedPath` matches `/change-password` exactly via `pathname === prefix`, so the new entry is reached.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/proxy.test.ts`
Expected: PASS for all existing plus four new.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts
git commit -m "feat: gate protected routes behind must-change-password"
```

---

### Task 5: Admin UI — add account and reset password

**Files:**
- Create: `src/components/add-account-form.tsx`
- Create: `src/components/reset-password-form.tsx`
- Modify: `src/app/(portal)/admin/users/page.tsx:15-29`

**Interfaces:**
- Consumes: `POST /api/users` (Task 1), `POST /api/users/[id]/reset-password` (Task 2), `userCreateSchema` field names.
- Produces: `AddAccountForm()` and `ResetPasswordForm({ userId, email })`.

There is no dialog primitive in `src/components/ui/`, so both are inline toggled forms built from the existing `Card`, `Input`, `Label`, `Select`, `Button` — do not introduce a modal library.

- [ ] **Step 1: Build `src/components/add-account-form.tsx`**

`"use client"`. No props. A `Button` labelled **Add account** toggles a `Card` form with `Input`s named `email`, `firstName`, `lastName`, `password`, and a `Select` named `role` offering only Alumni / Registrar / Admin — **omit Student**. Submit POSTs JSON to `/api/users`. On 201, replace the form with a confirmation panel showing name, email, role and the entered placeholder password with a copy button, plus the line: *They will be required to change this password when they first sign in.* On error, show `data.error` via `toast.error` and keep the form open.

- [ ] **Step 2: Build `src/components/reset-password-form.tsx`**

`"use client"`. Props `{ userId: string; email: string }`. A `Button` labelled **Reset password** toggles one `Input type="password"` and a confirm button. Submit POSTs to `/api/users/${userId}/reset-password`. On success `toast.success("Password reset. They will be asked to change it at next sign in.")` then `router.refresh()`.

- [ ] **Step 3: Wire into `src/app/(portal)/admin/users/page.tsx`**

Render `<AddAccountForm />` between `SectionHeading` and `DataTable`. In the `actions` column render `UserRoleActions` and `ResetPasswordForm` stacked vertically, passing `row.id` and `row.email`.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: TypeScript clean. Then `npm run dev`, sign in as an admin, and confirm the add form posts and the confirmation panel shows the placeholder once.

- [ ] **Step 5: Commit**

```bash
git add src/components/add-account-form.tsx src/components/reset-password-form.tsx "src/app/(portal)/admin/users/page.tsx"
git commit -m "feat: admin UI for creating staff accounts and resetting passwords"
```

---

### Task 6: The shared `/change-password` screen

**Files:**
- Create: `src/app/change-password/page.tsx`
- Create: `src/components/change-password-form.tsx`

**Interfaces:**
- Consumes: `PATCH /api/profile/password` (Task 3), `getCurrentDbUser()` from `@/lib/auth`, `AppLogo` from `@/components/layout/app-logo`.
- Produces: `ChangePasswordForm({ mustChangePassword }: { mustChangePassword: boolean })`.

- [ ] **Step 1: Build `src/components/change-password-form.tsx`**

`"use client"`. Props `{ mustChangePassword: boolean }`. Three `Input`s — `currentPassword`, `newPassword`, `confirmPassword` — and a submit button labelled **Set new password**. Client-side, reject when `newPassword !== confirmPassword` with *"Those passwords do not match."* POST via `fetch` with `method: "PATCH"` to `/api/profile/password`. On success `router.replace("/dashboard")` then `router.refresh()`; `/dashboard` already routes each role to its own home. When `mustChangePassword` is true, render a top banner: *Choose a new password to continue.* On failure show `data.error` inline.

- [ ] **Step 2: Build `src/app/change-password/page.tsx`**

A server component modelled on `src/app/sign-in/[[...sign-in]]/page.tsx` — same `main`/`AppLogo`/heading shell. `const user = await getCurrentDbUser();` and if `!user` call `redirect("/sign-in")` from `next/navigation`. Heading **Set a new password**, subtext *Your account was created with a temporary password.*, and render `<ChangePasswordForm mustChangePassword={user.mustChangePassword} />`.

- [ ] **Step 3: Verify**

Run: `npm run build`, then `npm run dev` and walk the whole flow: admin creates a registrar with a placeholder, the registrar signs in and is redirected to `/change-password`, cannot reach `/registrar/dashboard`, sets a new password, and lands on the registrar dashboard.

Expected: the redirect happens on the first navigation and stops once the password is changed.

- [ ] **Step 4: Commit**

```bash
git add src/app/change-password/page.tsx src/components/change-password-form.tsx
git commit -m "feat: shared change-password screen for forced password changes"
```
