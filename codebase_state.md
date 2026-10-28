# LANHS DRMS — Codebase State Overview

> **As of:** 2026-10-25 · local authentication + hardening, grades/COG removal, student CSV/XLSX import, certificate PDF overrides, registrar notifications, migration safety guard

## What This Is

**LANHS DRMS** — Luis Aguado National High School Student Records and Document Request Management System.

A **single-package Next.js 16 App Router** full-stack web app (flat `src/` tree, not a monorepo).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7, React 19, TypeScript |
| Auth | Local email/LRN accounts (bcryptjs), signed jose JWT sessions |
| Database | PostgreSQL + Drizzle ORM |
| Styling | Tailwind CSS v4 + shadcn-style local UI primitives |
| Animations | Framer Motion |
| Email | Resend |
| Spreadsheet | xlsx / csv-parse |
| PDF & QR | pdf-lib + qrcode |
| Blockchain | Solidity (Hardhat 3), Ethers.js v6 |
| Deployment | Vercel-ready |

---

## Folder Structure

```
blockchain-lanhs/
├── contracts/
│   └── DocumentRequestAudit.sol        # Single Solidity audit contract
├── drizzle/                            # 13 DB migrations (0000–0012)
├── scripts/
│   ├── seed.ts                         # Sample data seeder (SEED_PASSWORD; refuses production and non-local DBs)
│   ├── check-migrations.ts             # db:migrate safety guard (see Key Modules)
│   ├── bootstrap-admin.ts              # Interactive first-admin creation (npm run auth:bootstrap-admin)
│   ├── update-admin-role.ts            # One-off script: promotes a hardcoded user email to admin
│   ├── dev-all.ts                      # Hardhat node + contract deploy + next dev in one command
│   └── deploy-audit-contract.ts        # Hardhat deploy script
├── src/
│   ├── app/
│   │   ├── layout.tsx / globals.css    # Root layout
│   │   ├── page.tsx                    # Public landing page
│   │   ├── (portal)/                   # Auth-protected role group
│   │   │   ├── admin/                  # dashboard, users, roles, academic-setup, document-types, school-years, grade-levels, sections, settings, blockchain, search
│   │   │   ├── registrar/              # dashboard, requests, requests/[id], notifications, students, students/import, students/[id], certificates, certificates/[id], certificates/[id]/edit, reports, audit-logs, search
│   │   │   └── student/                # dashboard, requests, requests/new, requests/[id], notifications, profile, search
│   │   ├── api/                        # Route handlers: academic-setup, audit, auth (login/logout/signup), blockchain, certificates (+ [id], [id]/pdf), document-requests (+ [id]/slip, [id]/status), notifications (+ [id], read-all), profile, reports, students (+ [id], import/template, import/validate, import/commit), users
│   │   ├── dashboard/page.tsx          # Role-redirect landing
│   │   ├── about/ sign-in/ sign-up/    # Public pages
│   │   └── verify-certificate/[verificationCode]  # Public QR verification
│   ├── components/
│   │   ├── layout/                     # portal-shell.tsx (nav + unread badge), app-logo.tsx, route-loading.tsx
│   │   ├── ui/                         # shadcn-style primitives
│   │   ├── academic-setup-manager.tsx
│   │   ├── student-import-uploader.tsx # CSV/XLSX import preview uploader
│   │   ├── certificate-preview-editor.tsx  # PDF override editor (/registrar/certificates/[id]/edit)
│   │   ├── notifications-list.tsx      # Mark-one / mark-all read
│   │   ├── student-record-actions.tsx / student-record-form.tsx
│   │   ├── request-form.tsx / request-status-actions.tsx / registrar-request-details-view.tsx
│   │   ├── generate-certificate-button.tsx
│   │   ├── retry-blockchain-button.tsx / BlockchainVerificationBadge.tsx
│   │   ├── profile-update-form.tsx / auth-form.tsx / lrn-reminder-banner.tsx
│   │   ├── data-table.tsx / dashboard-card.tsx / search-results.tsx
│   │   ├── section-heading.tsx / status-badge.tsx / motion-reveal.tsx
│   │   └── user-role-actions.tsx
│   ├── db/
│   │   ├── index.ts                    # Drizzle connector
│   │   └── schema.ts                   # All table definitions (see below)
│   ├── lib/
│   │   ├── auth.ts                     # Current-user/role helpers, dashboardPathForRole, roleCanAccessPath
│   │   ├── session.ts                  # Session cookie set/clear (secure flag in production)
│   │   ├── session-token.ts            # jose JWT mint/verify + token_version revocation
│   │   ├── password.ts                 # bcryptjs compare + timing-equalizer dummy hash
│   │   ├── auth-rate-limit.ts          # Login/signup attempt limits (see Notable Observations)
│   │   ├── notifications.ts            # buildNewRequestNotification + formatUnreadCount ("99+" cap)
│   │   ├── constants.ts / types.ts / utils.ts / validators.ts / email.ts / email-template.ts / navigation.ts
│   │   ├── blockchain/                 # abi.ts (contract ABI), client.ts (ethers.js wrapper)
│   │   ├── audit/                      # SHA-256 canonical hash helpers
│   │   └── services/                   # Business logic layer
│   │       ├── academic-setup.ts
│   │       ├── audit-log.ts            # recordAuditedAction + blockchain audit submission/retry
│   │       ├── blockchain-verification.ts
│   │       ├── certificates.ts         # Generation, PDF, overrides, verify (see Key Modules)
│   │       ├── document-requests.ts    # Requests, slip PDF, canAccessRequestSlip
│   │       ├── live-data.ts            # Dashboard/list queries
│   │       ├── notifications.ts        # countUnread / markRead / markAll / fan-out / list
│   │       ├── pdf-brand.ts            # Shared PDF layout constants
│   │       ├── portal-search.ts
│   │       ├── student-import.ts       # CSV/XLSX parse, validate, atomic commit
│   │       └── student-records.ts
│   └── proxy.ts                        # Signed-session checks for protected routes
├── next.config.ts
├── drizzle.config.ts
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

---

## Key Modules

### Auth

- `src/lib/auth.ts` — `getCurrentDbUser`, `ensureCurrentDbUser`, `getCurrentRole`, `getCurrentProfile`, `dashboardPathForRole`, `roleCanAccessPath`
- `src/lib/session.ts` — session cookie helpers
- `src/lib/session-token.ts` — JWT mint/verify; `token_version` claim compared against `users.token_version` on every authenticated request (logout bumps it and revokes **all** outstanding cookies)
- `src/lib/password.ts` — bcryptjs compare with timing-equalizer dummy hash
- `src/lib/auth-rate-limit.ts` — PostgreSQL-backed attempt limits (see Notable Observations)
- `src/app/api/auth/login/route.ts`, `logout/route.ts`, `signup/route.ts` — the only auth endpoints
- `scripts/bootstrap-admin.ts` — interactive first-admin creation: prints only the DB host, requires typing `CREATE FIRST ADMIN`, hidden password entry (8–72 bytes), refuses when an admin exists

### Certificates — `src/lib/services/certificates.ts`

- Generation / lifecycle: `generateCertificate`, `listCertificateViews`, `getCertificateView`, `verifyCertificate`, `generateCertificatePdf`, `reissueCertificate`, `voidCertificate`
- PDF content overrides: `resolveCertificateDisplayFields` (a set override wins; empty/whitespace-only falls back to the live joined value), `getCertificateEditView`, `updateCertificateOverrides` (provided-key semantics; a missing key leaves the stored override untouched). Never applied to school year / certificate number / type (blockchain hash inputs).
- Columns: `certificates.override_student_name|override_grade_level|override_section|override_purpose|override_date_generated` (migration 0010)
- Signatory names (migration 0012): `certificates.override_registrar_name|override_principal_name` — typed per certificate in the preview editor, printed bold and centered above the PDF's signature lines (`drawSignatureName` in `pdf-brand.ts`, auto-shrunk to fit the signature block). Unlike the other overrides there is no live fallback: blank prints no name. Saved/cleared through the same PATCH as the other overrides (`buildOverrideUpdates`).
- Adding an override field touches three places together: the `certificates` columns, `certificateOverrideSchema`, and `OVERRIDE_FIELDS` + `buildOverrideUpdates`.
- API: `GET/PATCH /api/certificates/[id]` (PATCH saves overrides, staff only), `GET /api/certificates/[id]/pdf`
- UI: `certificate-preview-editor.tsx` at `/registrar/certificates/[id]/edit`

### Request slips — `src/lib/services/document-requests.ts`

- `canAccessRequestSlip(request, viewer)` — slip PDFs carry student PII: registrar/admin always, everyone else only a request they made (`requestedByUserId === viewer.id`)
- `generateRequestSlipPdf(id, viewer)` enforced through that policy, served at `/api/document-requests/[id]/slip`

### Notifications

- `src/lib/notifications.ts` — `buildNewRequestNotification(trackingNumber, documentType)`, `formatUnreadCount` (`null` ≤ 0, `"N"` < 100, `"99+"` ≥ 100)
- `src/lib/services/notifications.ts` — `countUnread(userId)`, `markRead(userId, notificationId)` (owner-scoped; 404 for non-owner), `markAll(userId)`, `fanOutNewRequestNotification(trackingNumber, documentType)`, `listUserNotifications(userId, limit = 20)`
- Fan-out targets **ACTIVE registrars only** (`role = 'registrar' AND is_active AND status = 'active'`); no admin copies. Called from `createDocumentRequest`.
- API: `PATCH /api/notifications/[id]` (mark one read), `POST /api/notifications/read-all`. Registrar page `/registrar/notifications`; badge wired in `portal-shell.tsx`.

### Student import — `src/lib/services/student-import.ts`

- `parseStudentImportFile` — CSV or XLSX; caps 5 MB / 500 rows. XLSX rows are read with `sheet_to_json(..., { UTC: true })`: xlsx ≥ 0.20 builds date cells at read time and only the UTC interpretation preserves the Excel calendar date in every server timezone.
- `mapStudentImportRow`, `validateStudentImportRows` — required fields, 12-digit LRN, `YYYY-MM-DD` birth dates, duplicate LRNs in-file and against `students`, grade level / section / school year name matching
- `commitStudentImport(input, { actor, recordAudit? })` — atomic transaction with a duplicate-LRN re-check (conflict returns 409 with per-row messages), then one `student_import` batch audit entry via `recordAuditedAction`
- API: `GET /api/students/import/template`, `POST /api/students/import/validate`, `POST /api/students/import/commit` (registrar/admin). UI at `/registrar/students/import` (`student-import-uploader.tsx`).

### Migration guard — `scripts/check-migrations.ts`

- Runs before `drizzle-kit migrate` **only** via `npm run db:migrate`; direct `npx drizzle-kit migrate` bypasses it
- Gates all irreversible data deletes behind `ALLOW_DESTRUCTIVE_MIGRATIONS=true` (0006 `users` wipe; 0008 Certificate of Grades / grade data — "cog" matched as a whole word so "Certificate of Recognition" is untouched, generated-certificate notifications purged by certificate number)
- Refuses out-of-band schema state (application tables but no `drizzle.__drizzle_migrations`) and mismatched recorded migrations (order / count / hash; CRLF-normalized hashes accepted as equal)
- Decision function `evaluateMigrationSafety(state)` is pure; `main()` injects DB/journal probes. Tests: `scripts/check-migrations.test.ts` (15).

---

## Database Schema (Tables)

| Table | Purpose |
|---|---|
| `users` | Local email/LRN accounts with password hashes, role (`admin/registrar/student/alumni`), `token_version` |
| `schoolYears` | School year records with active flag |
| `gradeLevels` | Grade levels (ordered) |
| `sections` | Sections linked to grade level + school year |
| `students` | Student profiles linked to optional user account |
| `authRateLimits` | Login/signup attempt buckets (HMAC bucket keys, 15-minute windows) |
| `documentTypes` | Configurable document types with fees & requirements |
| `documentRequests` | Request submissions with tracking numbers & full status lifecycle |
| `requestStatusHistory` | Append-only status change audit trail (`fromStatus`/`toStatus`, `actorUserId`) |
| `certificates` | Generated certificates with QR & blockchain proof + PDF content override columns (0010) |
| `notifications` | In-app notifications per user |
| `auditLogs` | Canonical action audit log with SHA-256 record hash |
| `blockchainAuditLogs` | On-chain submission tracking (pending/submitted/failed/verified, retry scheduling) |

**Enums:** `user_role`, `account_status`, `student_type`, `student_status`, `request_status`, `blockchain_status`, `notification_type` (`request`, `certificate`, `system`, `audit`)

**Migrations (13, `0000`–`0012`):**

| File | Effect |
|---|---|
| `0000` | Initial schema and types |
| `0001` | `certificates` table + supporting enum values (`alumni` role, `certificate` notification type, student/status enums) |
| `0002` | Drops legacy `students.student_number` |
| `0003` | Drops redundant columns (`request_status_history` old/new status, `changed_by`, …) |
| `0004` | Blockchain metadata columns (`block_number`, `network`) |
| `0005` | Retry scheduling (`last_retry_at`, `next_retry_at`) |
| `0006` | Pre-local-auth (Clerk) account removal: wipes `users` rows, drops user FK constraints |
| `0007` | `auth_rate_limits` table; `users.lrn` becomes nullable for operator-provisioned staff |
| `0008` | Removes all Certificate of Grades and grade data, drops the grade tables (`student_grades`, `subjects`, `grade_import_batches`, `grade_import_errors`), rebuilds `notification_type` without `grade` |
| `0009` | `users.token_version` for session revocation |
| `0010` | Certificate PDF override columns |
| `0011` | `users.must_change_password` for the forced password change on first sign-in |
| `0012` | Certificate signatory name columns (`override_registrar_name`, `override_principal_name`) |

---

## User Roles & Portals

| Role | Portal Prefix | Key Capabilities |
|---|---|---|
| `admin` | `/admin/` | Users, roles, academic setup, document types, school years, grade levels, sections, settings, blockchain retry |
| `registrar` | `/registrar/` | Requests queue + status actions, certificate generation + PDF override editor, student records + CSV/XLSX import, notifications (unread badge, mark-one/mark-all), reports, audit logs |
| `student`/`alumni` | `/student/` | Submit requests, track status, download own request slip, notifications, profile |

---

## Blockchain Architecture

- **Contract:** `DocumentRequestAudit.sol` (Hardhat 3, Ethers.js v6)
- **Privacy rule:** Only stores `referenceType`, `referenceId`, `action`, `actorRole`, `recordHash`, `timestamp` — **no PII on-chain**
- **Flow:** Save locally → SHA-256 hash → attempt on-chain call → store tx hash if successful → leave as `pending` for admin retry if failed
- **Networks:** Local Hardhat node or Sepolia testnet

---

## Notable Observations

> [!NOTE]
> `src/proxy.ts` provides signed-session route protection for portal and API routes.

> [!NOTE]
> Auth rate limiting (`src/lib/auth-rate-limit.ts`): PostgreSQL-backed login/signup attempt limits — TRUST_PROXY-gated per-address buckets plus per-identifier buckets that always apply (HMACed keys, never raw addresses/identifiers; a successful login clears its buckets). With no trusted address (the default deployment), login and signup each draw on a per-instance in-memory fallback budget — 30 attempts burst, refilling 30 per 15 minutes per endpoint (a successful login restores the login budget at most once per 60 seconds) — and fallback-denied attempts are not counted against the credential bucket. Signup returns one identical 400 for every roster-match failure; the 409 "An account already uses that email or LRN." is a deliberate, documented account-existence oracle. Login always runs a bcryptjs compare (timing equalizer).

> [!NOTE]
> Migration guard (`scripts/check-migrations.ts`): gates all irreversible data deletes (0006 users wipe, 0008 COG/grade data) behind `ALLOW_DESTRUCTIVE_MIGRATIONS=true` and detects out-of-band / mismatched migration state. `npm run db:migrate` runs it first; `npx drizzle-kit migrate` does not. The dev database currently records the pre-fix 0008 hash, so the guard (correctly) refuses there until the one-statement hash realignment documented in the README's Database troubleshooting section is applied.

> [!NOTE]
> Student import XLSX date cells are TZ-safe only because `sheet_to_json` is called with `UTC: true` (pinned by a regression test that needs a non-UTC `TZ` run to have teeth). `students.birth_date` is `timestamptz`; read-side date formatting can still show the previous day in timezones behind UTC — follow-up ticket.
