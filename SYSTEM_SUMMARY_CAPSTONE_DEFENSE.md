# LANHS DRMS — System Summary for Capstone Defense

**System name:** Luis Aguado National High School Student Records and Document Request Management System (LANHS DRMS)  
**Purpose:** Provide a role-based web system for student account registration, document requests, registrar processing, certificate generation, student record management, reporting, and audit verification.

This summary reflects the code currently present in the repository. File paths below are relative to the project root.

## 1. Short project explanation

LANHS DRMS replaces a number of registrar and student service tasks with a web workflow. Students or alumni can register, submit and track document requests, receive notifications, and access their profile. Registrar staff process requests and registrations, manage student records, generate certificates, and review reports and audit logs. The administrator manages accounts and system configuration, and can review operational data and the blockchain trail.

The application stores working records in PostgreSQL. It computes hashes for selected records and submits those hashes and reference information to a Solidity audit contract. Full student profiles and certificate PDFs are kept off-chain.

## 2. Roles and major functions

| Role | Main functions | Main page locations |
| --- | --- | --- |
| **Student / Alumni** | View dashboard and notifications; submit document requests; view request status and history; update profile; download permitted request slips and certificates. New student accounts must be approved before sign-in. | `src/app/(portal)/student/`, `src/app/(portal)/layout.tsx` |
| **Registrar** | Review registration requests; view and update student records; review and update document requests; generate, preview, and download certificates; view reports and logs; receive registrar notifications. | `src/app/(portal)/registrar/`, `src/app/(portal)/layout.tsx` |
| **Administrator** | Manage accounts and registration decisions; view student records within User Management; manage document types and certificate templates; view operational pages, reports, settings, and blockchain trail; download the audit trail PDF. | `src/app/(portal)/admin/`, `src/app/api/admin/blockchain/pdf/route.ts` |
| **Public visitor** | View the landing/About pages; sign up or sign in; submit certificate or tracking information for public verification. | `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/sign-in/`, `src/app/sign-up/`, `src/app/verify/`, `src/app/verify-certificate/` |

The role-based sidebar is configured in `src/lib/navigation.ts`; the shared navigation, responsive shell, global search, notifications, and account actions are in `src/components/layout/portal-shell.tsx`. Individual role layouts apply role checks in `src/app/(portal)/admin/layout.tsx`, `src/app/(portal)/registrar/layout.tsx`, and `src/app/(portal)/student/layout.tsx`.

## 3. Core workflows

### Registration and login

1. A student or alumnus submits account and profile details through the sign-up page.
2. The server validates the input, hashes the password, and creates the account and linked student record in a database transaction.
3. The account starts with a pending registration status. A registrar or administrator reviews and approves or declines it.
4. Approved users sign in by email or LRN and receive a signed session cookie.

**Code:** `src/app/api/auth/signup/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/lib/services/registrations.ts`, `src/lib/services/account-admin.ts`, `src/components/auth-form.tsx`.

### Document request processing

1. An authenticated student submits a request for an active document type and supplies the needed purpose and school/grade details.
2. The system creates a tracking number and saves the request.
3. Registrar users review the queue and update the request status and remarks.
4. Status changes are added to request history. Relevant users receive in-app notifications; configured email delivery is attempted.
5. Staff can generate the certificate, mark it ready for pickup, and record when it is claimed. Students can follow progress and download documents they are authorized to access.

**Code:** `src/lib/services/document-requests.ts`, `src/lib/services/live-data.ts`, `src/lib/services/notifications.ts`, `src/components/request-form.tsx`, `src/components/request-status-actions.tsx`, `src/app/api/document-requests/`, `src/app/api/notifications/`.

### Student records and account management

Student records contain identity and contact information, LRN, student type/status, enrollment status, and school-year fields. Registrar pages list and edit student records. Admin User Management combines account management and a student-records section; a student detail view includes profile information, requests, and generated certificates.

**Code:** `src/app/(portal)/registrar/students/`, `src/app/(portal)/admin/users/page.tsx`, `src/app/(portal)/admin/users/[id]/page.tsx`, `src/components/student-record-modal.tsx`, `src/lib/services/student-records.ts`, `src/lib/services/live-data.ts`, `src/app/api/students/`, `src/app/api/users/`.

### Certificate generation and verification

The system generates downloadable certificate PDFs using school layouts, school fonts, signatory information, and QR verification data. A registrar can preview and edit supported per-certificate display fields before download. The public verification flow checks the certificate/reference and reports whether its blockchain proof matches, is pending, or is invalid. Public results expose certificate-related details, not the full student profile.

**Code:** `src/lib/services/certificates.ts`, `src/lib/services/certificate-renderer.ts`, `src/lib/services/certificate-layouts.ts` (generated layouts), `src/lib/services/certificate-wording-defaults.ts`, `src/lib/services/pdf-brand.ts`, `src/lib/services/verification-lookup.ts`, `src/lib/services/blockchain-verification.ts`, `src/app/api/certificates/`, `src/app/verify-certificate/[verificationCode]/page.tsx`.

### Reporting and audit trail

Reports cover request summaries, claimed documents, generated certificates, and student records. The same reporting service renders report PDFs and an audit-trail PDF. Audit records are written to PostgreSQL with actor, action, entity, timestamp, metadata, and record hash. The admin blockchain page provides chain status and retry controls for pending eligible records.

**Code:** `src/lib/services/reports.ts`, `src/lib/services/live-data.ts`, `src/lib/services/audit-log.ts`, `src/lib/audit/hash.ts`, `src/lib/audit/canonical.ts`, `src/app/(portal)/registrar/reports/`, `src/app/(portal)/registrar/audit-logs/`, `src/app/(portal)/admin/reports/`, `src/app/(portal)/admin/blockchain/`, `src/app/api/reports/`, `src/app/api/admin/blockchain/pdf/route.ts`.

### Document type, template, settings, and notifications

Administrators configure available document types, certificate wording/layout and signatory values, and system settings. Notifications are user-scoped, can be marked read individually or in bulk, and appear in the shared portal header.

**Code:** `src/lib/services/document-types.ts`, `src/lib/services/document-type-templates.ts`, `src/lib/services/system-settings.ts`, `src/lib/services/notifications.ts`, `src/components/document-type-template-editor.tsx`, `src/components/notification-bell.tsx`, and the related admin pages under `src/app/(portal)/admin/`.

## 4. Architecture and code map

```text
Browser pages and UI components
call into
Next.js App Router pages + API route handlers (src/app/)
which use
Domain services, validation, auth, PDF and audit helpers (src/lib/)
and persist to
PostgreSQL via Drizzle ORM (src/db/)
Selected record hashes also go through Ethers.js to the Solidity audit contract.
```

- **Pages and APIs:** `src/app/` contains public pages, role portals, and server API handlers. API routes are grouped by domain under `src/app/api/`.
- **Shared UI:** `src/components/` contains forms, tables, action controls, portal layout, PDF download controls, notifications, and reusable UI primitives.
- **Database:** `src/db/schema.ts` defines the Drizzle schema; `src/db/index.ts` creates the PostgreSQL connection. `drizzle/` contains versioned SQL migrations.
- **Domain logic:** `src/lib/services/` contains request, registration, account, student, certificate, notification, report, and settings behavior. `src/lib/validators.ts` defines Zod input validation.
- **PDFs:** `src/lib/services/certificate-renderer.ts` generates certificates; `src/lib/services/reports.ts` generates reports and audit PDFs; `src/lib/services/document-requests.ts` renders request slips.
- **Blockchain:** `src/lib/blockchain/client.ts` connects through Ethers.js; `src/lib/blockchain/abi.ts` defines the contract interface; `contracts/DocumentRequestAudit.sol` stores audit records.
- **Operational scripts:** `scripts/bootstrap-admin.ts` creates the initial admin; `scripts/check-migrations.ts` guards migration execution; `scripts/dev-all.ts` coordinates local app/chain development; `scripts/deploy-audit-contract.ts` deploys the contract.

## 5. Main database entities

The core schema in `src/db/schema.ts` defines:

- `users` — login identity, email, password hash, role, account/registration states, session token version, and forced password-change flag.
- `students` — student profile data, optionally linked to a user account.
- `document_types` — requestable document types, requirements, processing days, fee, and active state.
- `document_requests` — requester/student, tracking number, requested document, purpose, status, remarks, and lifecycle timestamps.
- `request_status_history` — chronological status transitions and remarks.
- `certificates` — generated certificate identity, verification code, QR data, PDF/hash/chain metadata, and display overrides.
- `notifications` — per-user notifications and read state.
- `audit_logs` — application audit records and hashes.
- `blockchain_audit_logs` — on-chain submission status, transaction data, errors, and retry scheduling.
- `auth_rate_limits`, `system_settings`, and template tables — login/signup throttling, application configuration, and certificate wording/layout configuration.

## 6. Blockchain and data integrity explanation

The app builds deterministic canonical data for supported audit records, serializes it in a stable key order, and computes a SHA-256 hash. It stores the full operational data in PostgreSQL and submits selected references, actions, actor-role labels, and hashes to the contract. The contract stores timestamps and indexes records by reference. It does not store student profiles, LRNs, contact information, or PDFs.

The app tracks chain submission state locally. If the RPC/contract configuration is missing or a transaction fails, the eligible event remains pending and can be retried. Certificate verification recomputes the expected canonical hash and compares it with on-chain records.

**Key code:** `src/lib/audit/canonical.ts`, `src/lib/audit/hash.ts`, `src/lib/services/audit-log.ts`, `src/lib/services/blockchain-verification.ts`, `src/lib/blockchain/client.ts`, `contracts/DocumentRequestAudit.sol`.

**Defense precision:** This blockchain layer provides a tamper-evident hash record and verification path. It does not put the database on-chain, encrypt student data, or independently prove a human actor's identity. The app supplies the actor-role label when it submits the record.

## 7. Security controls currently implemented

- Passwords are hashed with bcrypt; login uses a dummy hash for unknown identifiers to reduce timing-based account discovery.
- Signed HS256 session tokens have a seven-day lifetime and a minimum 32-byte `SESSION_SECRET` requirement.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Token-version comparison supports session revocation.
- Student sign-in is gated on registrar approval. User active/status checks are made on protected requests.
- Authentication rate limiting uses PostgreSQL HMAC buckets and a per-instance fallback when a trusted client address is unavailable.
- Zod schemas validate incoming account, profile, request, and record data.
- Proxy checks apply authentication by default to API routes except login/signup, check same-origin source headers for API writes, and fail closed when the database is unavailable. Role layouts and handlers/services also perform access checks.
- Rendered pages get a per-request nonce-based Content Security Policy; baseline browser security headers are configured in `next.config.ts`.

**Code:** `src/proxy.ts`, `src/lib/session-token.ts`, `src/lib/session.ts`, `src/lib/auth.ts`, `src/lib/auth-rate-limit.ts`, `src/lib/api-guards.ts`, `src/lib/validators.ts`, `next.config.ts`.

## 8. Technology stack and operation

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Framer Motion.
- PostgreSQL with Drizzle ORM.
- bcryptjs, JOSE, and Zod for local authentication/session and validation.
- `pdf-lib` and `qrcode` for PDFs and QR generation; `xlsx` is a dependency.
- Solidity, Hardhat, and Ethers.js for the audit contract.
- Resend integration for email notifications when the service is configured.

Common commands are defined in `package.json`: `npm run dev`, `npm run dev:all`, `npm run db:migrate`, `npm run build`, `npm run lint`, `npm run test:unit`, `npm run chain:compile`, and `npm run chain:deploy`. Required and optional environment values are described in `.env.example` and `README.md`.

## 9. Defense walkthrough suggestion

1. Show the public landing page and student signup, explaining that accounts begin pending.
2. Sign in as a registrar and approve a pending registration.
3. Sign in as a student, submit a document request, and show its tracking number and status history.
4. Return as registrar, review the request, update status, and generate/preview the certificate.
5. Scan the certificate QR or enter its verification code on the public page.
6. Show the admin's account/student-record management and reports.
7. Finish on the blockchain trail: compare a local audit item with its chain status and show the audit PDF.

Use a demo database and test identities for the walkthrough; do not expose real student personal data during the defense.

## 10. Items to verify before the defense

1. **Spreadsheet import scope:** The current portal does not include bulk CSV/XLSX student import. The `xlsx` package remains listed as a dependency, but the app source does not currently use it. Keep slides and the defense demo aligned with the implemented record-management workflow.
2. **Blockchain configuration:** Demonstrate the configured local or test network, contract address, and pending/retry behavior. Without RPC, signer, and contract settings, chain submissions remain pending.
3. **Data privacy in public verification:** Explain which certificate details are intentionally shown and confirm that the sample/demo data is appropriate for public display.
4. **External deployment controls:** The source code cannot establish production TLS, database backups/encryption, edge/WAF rate limits, or secret-management configuration. Describe only controls that are actually configured in the deployment.

