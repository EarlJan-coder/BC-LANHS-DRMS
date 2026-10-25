# LANHS DRMS

Luis Aguado National High School Student Records and Document Request Management System.

LANHS DRMS is a full-stack registrar portal for online document requests, student records, bulk student import, certificate PDF generation with preview overrides, QR verification, email notifications, and blockchain-backed audit proofs.

## Features

- Public landing page, email/LRN sign-in and signup, and public certificate verification.
- Role dashboards for Admin, Registrar, and Student/Alumni.
- Local user role management backed by PostgreSQL.
- Student document request submission with tracking numbers, remarks, status timeline, notifications, email attempts, request-slip PDFs (staff or the requesting student only), and audit logging.
- Registrar request queue with search/filter, status actions, certificate generation, ready/claimed workflow, and blockchain proof status.
- Student records with bulk CSV/XLSX import: XLSX template download, preview validation, per-row error messages, duplicate LRN detection, atomic batch saving, and a batch audit entry.
- Certificate PDFs with QR verification URL, a registrar preview editor for per-certificate content overrides, public privacy-safe verification page, and blockchain hash proof.
- Registrar notifications: document-request submissions fan out one in-app notification per ACTIVE registrar (no admin copies); registrar nav shows an unread badge (server-rendered count, "99+" cap) with mark-one / mark-all read at /registrar/notifications.
- Admin user, document type, school year, grade level, section, settings, and blockchain retry screens.
- Solidity smart contract and Hardhat workflow for local and Sepolia deployment.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS with shadcn-style local UI primitives
- Framer Motion for landing-page motion
- PostgreSQL and Drizzle ORM
- Local email/LRN authentication with bcrypt password hashes and signed sessions
- Resend email
- `xlsx` for spreadsheet import
- `pdf-lib` and `qrcode` for certificate PDFs and verification QR codes
- Solidity, Hardhat, and Ethers.js

## Folder Structure

```text
src/app/                     App Router pages and API route handlers
src/app/(portal)/            Role-protected Admin, Registrar, Student pages
src/components/              Layout, forms, tables, buttons, cards, client actions
src/components/ui/           shadcn-style UI primitives
src/db/                      Drizzle database connector and schema
src/lib/                     Auth, validators, constants, utilities
src/lib/services/            Business logic for requests, students, certificates, notifications, audits
src/lib/blockchain/          Ethers.js ABI and contract client
src/lib/audit/               Canonical JSON hashing helpers
contracts/                   Solidity contract
scripts/                     Seed, migration guard, first-admin bootstrap, contract deployment
drizzle/                     Database migrations
public/                      LANHS logo and static assets
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill the values you use locally or on Vercel:

```bash
cp .env.example .env.local
```

Required for a full production-like run:

- `DATABASE_URL`
- `SESSION_SECRET` (at least 32 bytes)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `SEPOLIA_RPC_URL`
- `CONTRACT_ADDRESS`

The app also accepts the legacy aliases `BLOCKCHAIN_RPC_URL` and `DOCUMENT_AUDIT_CONTRACT_ADDRESS`. `CERTIFICATE_SECRET` is listed in `.env.example` but no code currently reads it.

Operational variables (optional; each is documented in `.env.example`):

- `TRUST_PROXY` — enables per-address auth rate-limit buckets; see Local Authentication.
- `IP_ATTEMPT_LIMIT` (default `20`) and `LOGIN_ATTEMPT_LIMIT` (default `5`) — auth attempt caps per 15-minute window.
- `SEED_PASSWORD` — required before `npm run db:seed`; 8–72 bytes, development only.
- `ALLOW_REMOTE_SEED` — set to `"true"` to allow seeding a database on a non-local host.
- `ALLOW_DESTRUCTIVE_MIGRATIONS` — set to `"true"` only after taking a backup, to let pending irreversible data deletes run under `npm run db:migrate`; see Database.

## Local Setup

```bash
npm install
npm run db:migrate
npm run dev:all    # starts Hardhat node, compiles & deploys contract, and boots Next.js in 1 command
# OR: npm run dev  # for standalone Next.js
```

Open `http://localhost:3000`.

`src/proxy.ts` checks signed sessions for portal and API routes. `/dashboard` redirects by local database role, and role layouts enforce student, registrar, and admin access.

## Database

The database schema is in `src/db/schema.ts`.

Generate migrations after schema edits:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

`npm run db:migrate` runs `scripts/check-migrations.ts` before `drizzle-kit migrate`. Running `npx drizzle-kit migrate` directly bypasses the guard. The guard refuses to run in three situations:

1. **Irreversible data deletes are pending.** Migration `0006` deletes every row in `users` (student, request, certificate, notification, and audit records are kept). Migration `0008` deletes all Certificate of Grades data (certificates, their requests and document types, and notifications naming their certificate or tracking numbers — "cog" is matched as a whole word, so a "Certificate of Recognition" is untouched) and all grade data (`student_grades`, `subjects`, `grade_import_batches`, `grade_import_errors`, and `type = 'grade'` notifications, then drops the grade tables). When such rows exist in a database that is still before these migrations, the guard lists each statement with the number of rows it would destroy and aborts. Back up first (`pg_dump`), then set `ALLOW_DESTRUCTIVE_MIGRATIONS=true` to acknowledge the deletes. Fresh databases and databases already past these migrations are unaffected.
2. **The schema was applied out of band.** If the database has application tables but no `drizzle`.`__drizzle_migrations` table (for example after `drizzle-kit push` or manual SQL), the guard refuses and lists recovery options: reconcile with `drizzle-kit push`, or baseline manually (create `drizzle`.`__drizzle_migrations` with `id serial, hash text, created_at bigint` and insert one row per already-applied migration — `hash` = sha256 of the `.sql` file, `created_at` = its `when` from `drizzle/meta/_journal.json`).
3. **Recorded migrations do not match the migration files.** If the rows in `drizzle`.`__drizzle_migrations` are not an in-order prefix of `drizzle/meta/_journal.json` (wrong order, too many rows, or a recorded hash that no longer matches the file — line-ending drift is ignored), the guard names the offending migration and both hashes and aborts.

> [!TROUBLESHOOTING]
> **`db:migrate` refuses with a hash mismatch for `0008_flawless_bushwacker`.** This is expected on the development database after `0008` was edited in place (the file changed after it ran). If the database already reflects the current file's outcome (no Certificate of Grades or grade data left), realign the recorded hash with one statement, then re-run `npm run db:migrate`:
>
> ```sql
> UPDATE drizzle.__drizzle_migrations
> SET hash = 'e23e17d6cf68b8ff6626ffeec95499692003942357213eb7cfbe9fda0f52d0eb'
> WHERE created_at = 1792816289455;  -- 0008_flawless_bushwacker
> ```
>
> In general, the guard's hash-mismatch message prints the exact current hash to write into that row; only do this when the database already reflects the current file.

Seed sample data:

```bash
npm run db:seed
```

Before running the seed command, set `SEED_PASSWORD` to a development-only password of 8–72 bytes. The four sample accounts (admin, registrar, student, alumni) use that password and must not be seeded in production — the seeder refuses to run when `NODE_ENV` is `production`, and it also refuses a database on a non-local host unless `ALLOW_REMOTE_SEED="true"` is set. Seed data includes the 2026-2027 school year, grade levels 7–12, two Grade 12 sections, document types, the four sample accounts, one sample student, and one sample document request with its status history.

## Local Authentication

Set `SESSION_SECRET` in `.env.local` and in the deployment environment. Generate a separate random value of at least 32 bytes for every environment, and never copy the local value into production. To generate one, run `node -p "require('node:crypto').randomBytes(32).toString('base64url')"` and save the output directly in that environment's secret settings.

Signup collects email, a 12-digit LRN, first and last name, and password. Registration only links an existing, unlinked student record whose LRN and normalized first and last names match; it always creates a student account. This roster match does not independently verify control of the LRN or email, so use an identity-verification process outside signup if that level of assurance is required.

Session JWTs carry the user's `token_version`, and every authenticated request compares it against `users.token_version`. Logging out increments that version, which invalidates **all** outstanding session cookies for the account immediately (including stolen copies), not just the cookie being cleared. After deploying this change, existing sessions minted without the claim are rejected once, forcing a one-time re-login.

When an unauthenticated browser request is redirected to `/sign-in`, the original path is preserved as a sanitized `?next=` parameter and the user returns there after logging in. Only same-origin, non-API page paths are accepted; anything else falls back to `/dashboard`.

Registrars can add student records in bulk from **Student records → Import students** (see the Student Import section below): download the XLSX template, fill it in, and upload a CSV or Excel file. The import validates, previews, and saves the full batch atomically. It creates student records only; students create their own login accounts later.

Login allows at most `IP_ATTEMPT_LIMIT` attempts per client address (default 20) and `LOGIN_ATTEMPT_LIMIT` attempts per address-and-identifier pair (default 5) in a 15-minute window; signup allows `LOGIN_ATTEMPT_LIMIT` attempts per LRN in the same window. A successful login clears its address and credential buckets instead of counting against them. The limiter stores HMACs of those keys in PostgreSQL, not raw addresses or identifiers.

Per-address buckets are only active when `TRUST_PROXY` is set to `true` (or `1`) **and** the deployment sits behind a reverse proxy that overwrites `X-Real-IP` or `X-Forwarded-For` with the actual client address. With the variable unset (the default), Next.js exposes no socket address, so address-keyed buckets are skipped entirely — trusting client-supplied headers would let an attacker rotate `X-Forwarded-For` to bypass them. The per-identifier buckets still apply in every configuration, so brute-force attempts against a known email or LRN remain limited either way. When no trusted client address is available, login and signup each draw instead on a per-instance fallback budget — 30 attempts burst, refilling 30 per 15 minutes, held in process memory and reset by a restart — and a successful login restores the login budget at most once per 60 seconds. All unaddressed clients of an instance share that budget, so expect 429s under heavy simultaneous traffic without `TRUST_PROXY`; for callers without a valid credential the budget bounds the CPU one instance can be made to spend on password hashing. A caller who holds one valid credential is bounded too, but less tightly: each successful login can restore the login budget once per 60 seconds, so their sustained ceiling is roughly one burst per minute rather than 30 per 15 minutes (see below).

> [!IMPORTANT]
> Password hashing uses `bcryptjs` (pure JavaScript), so each login or signup costs ~0.5s of main-thread CPU. Per-identifier buckets do **not** cap request volume from an attacker rotating identifiers. When no client address is available, the per-instance fallback budget bounds that volume at 30 attempts per endpoint burst plus 30 per 15 minutes for callers without a valid credential; a caller who holds one valid credential can additionally restore the login budget (at most once per 60 seconds) by logging in successfully, so their bounded volume is higher — roughly one burst per minute — but still finite. The budget is per process, so multi-instance deployments multiply it. Production deployments should still add an edge-level rate limit (Cloudflare, nginx, or a platform WAF) in front of `/api/auth/*`. Migrating to native `bcrypt`/`@node-rs/bcrypt` would remove most of this cost.

Signup responses do not reveal whether an LRN exists or whether a submitted name matches the school record: every roster-match failure (unknown LRN, name mismatch, or a lost link race) returns the same 400 response. One deliberate exception: a 409 "An account already uses that email or LRN." confirms that an account already exists for that email or LRN. This is a known account-existence oracle, accepted because there is no email-verification flow to hide behind and roster matching already reveals LRN existence; do not describe signup as concealing account existence. Rate limiting (per-LRN buckets plus the per-instance fallback budget) bounds how fast the oracle can be probed — it does not remove it. Login likewise always performs a password comparison, so response timing does not reveal valid emails or LRNs.

Migration `0006` removes existing account rows while retaining student, request, certificate, notification, and audit records. Historical user UUIDs remain in attribution fields. Migration `0007` makes user LRN nullable for operator-provisioned staff accounts and adds the rate-limit table. Migration `0008` removes all Certificate of Grades and grade data and drops the grade tables. Migration `0009` adds `users.token_version` for session revocation. Migration `0010` adds the certificate PDF override columns. There are 11 migrations in total (`0000`–`0010`).

The first production admin is created by an operator only after verifying the person's identity through the school's trusted process. Apply migrations first, then run `npm run auth:bootstrap-admin` from a secured interactive terminal with the intended `DATABASE_URL` and `SESSION_SECRET`. The script displays only the database host, requires typing `CREATE FIRST ADMIN`, hides the password (8–72 bytes) while entered, and refuses to run if an admin already exists. It creates an admin account without an LRN; the script is not a public signup path.

The `0006` destructive migration was rehearsed against an isolated local PostgreSQL-compatible staging database with synthetic account and student fixtures. It was also already applied to the remote Neon database configured in this workspace, where it removed 11 user accounts while retaining student/request/audit records. Confirm that database is the intended target before any further production deployment.

The workspace has no linked Vercel project or Vercel CLI, so production `SESSION_SECRET` could not be inspected from here. Before deployment, set a fresh production-only secret of at least 32 random bytes in the production environment settings, then verify its presence and strength there without copying it into logs or source control. The local `.env.local` secret is not a production confirmation.

Role redirects:

- Admin: `/admin/dashboard`
- Registrar: `/registrar/dashboard`
- Student/Alumni: `/student/dashboard`

## Resend Email

Set:

```bash
RESEND_API_KEY=""
RESEND_FROM_EMAIL="LANHS DRMS <no-reply@lanhsdrms.online>"
```

Request submission, request updates, and certificate generation attempt professional school-themed email notifications. Email failures do not roll back the main database transaction.

## Student Import (CSV/XLSX)

Registrar workflow:

1. Go to `/registrar/students/import` (**Student records → Import students**).
2. Download the XLSX template.
3. Fill the required columns (12-digit LRN, first name, last name, student type, status, enrollment status). Guardian, contact, academic placement, and the remaining columns are optional.
4. Upload a CSV or Excel file (5 MB and 500 rows maximum).
5. Review valid rows and error rows.
6. Save the batch.

Validation checks include required fields, 12-digit LRNs, `YYYY-MM-DD` birth dates, valid emails, duplicate LRNs within the file and against existing student records, and grade level, section, and school year names against academic setup. Saving is atomic — either the whole batch lands or none of it — and writes one batch audit entry naming the imported LRNs. The import creates student records only; students create their own login accounts later.

XLSX date cells (for example Birth Date) are read with `sheet_to_json`'s `UTC: true` option so the Excel calendar date survives every server timezone. A regression test pins this; it can only detect a revert when the suite runs in a non-UTC timezone, so run `npm run test:unit` with a non-UTC `TZ` in at least one CI job.

> [!WARNING]
> **Data audit:** deployments that ran an XLSX student import **before** the `UTC: true` fix on a server in a timezone ahead of UTC may have birth dates stored one day early — re-check imported birth dates against the source spreadsheets. Known follow-up: `birth_date` is stored as `timestamptz`, so read-side date formatting can still display the previous day in timezones behind UTC until display formatting is made timezone-aware.

## Certificates

Registrar workflow:

1. Open a document request and generate the certificate.
2. Preview the PDF and adjust its content at `/registrar/certificates/[id]/edit` — per-certificate overrides for student name, grade level, section, purpose, and date generated. An empty override renders the live student/request value.
3. Download the PDF.
4. Scan the QR code or open `/verify-certificate/[verificationCode]`.

The public verification page shows only non-sensitive information: certificate number, partial student name, certificate type, issue date, school, and blockchain transaction status.

## Blockchain Setup

Compile the smart contract:

```bash
npm run chain:compile
```

Start a local Hardhat node:

```bash
npm run chain:node
```

Deploy the audit contract:

```bash
npm run chain:deploy
```

Copy the deployed address to `CONTRACT_ADDRESS`.

For Sepolia, set `SEPOLIA_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, and deploy using your configured network.

## Blockchain Privacy Rule

Never store student records, grades, LRN, email, phone number, address, or PDFs on-chain.

The contract stores only:

- `referenceType`
- `referenceId`
- `action`
- `actorRole`
- `recordHash`
- `timestamp`

The app saves the local transaction first, creates a SHA-256 canonical JSON hash, attempts the blockchain call, stores the transaction hash if successful, and leaves failed submissions as pending for retry from `/admin/blockchain`.

## Verification Commands

```bash
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
npm run chain:compile
```

## Deployment Notes

The project is Vercel-ready. Configure environment variables in Vercel, provision PostgreSQL, run migrations, seed initial configuration only in development, verify Resend domain/sender settings, deploy the smart contract, and set `CONTRACT_ADDRESS`.
