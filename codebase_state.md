# LANHS DRMS — Codebase State Overview

> **As of:** 2026-09-11 · HEAD `f80f72b`

## What This Is

**LANHS DRMS** — Luis Aguado National High School Student Records and Document Request Management System.

A **single-package Next.js 16 App Router** full-stack web app (not a monorepo). The recent `git reset --hard origin/main` removed leftover `apps/`, `packages/`, `public/lanhs.jpg`, and `src/lib/api-client.ts` directories/files that had been added in a previous local working branch.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7, React 19, TypeScript |
| Auth | Clerk (`@clerk/nextjs` ^7) |
| Database | PostgreSQL + Drizzle ORM |
| Styling | Tailwind CSS v4 + shadcn-style local UI primitives |
| Animations | Framer Motion |
| Email | Resend |
| Spreadsheet | xlsx / exceljs / csv-parse |
| PDF & QR | pdf-lib + qrcode |
| Blockchain | Solidity (Hardhat 3), Ethers.js v6 |
| Deployment | Vercel-ready |

---

## Folder Structure

```
blockchain-lanhs/
├── contracts/
│   └── DocumentRequestAudit.sol        # Single Solidity audit contract
├── drizzle/                            # 3 DB migrations (0000–0002)
├── scripts/
│   ├── seed.ts                         # Sample data seeder
│   └── deploy-audit-contract.ts        # Hardhat deploy script
├── src/
│   ├── app/
│   │   ├── layout.tsx / globals.css    # Root layout
│   │   ├── page.tsx                    # Public landing page
│   │   ├── (portal)/                   # Auth-protected role group
│   │   │   ├── admin/                  # Admin pages (blockchain, users, document-types, grade-levels, sections, school-years, subjects, settings, roles, dashboard)
│   │   │   ├── registrar/              # Registrar pages (dashboard, students, grades, requests, certificates, reports, academic-setup, audit-logs)
│   │   │   └── student/               # Student pages (dashboard, requests, notifications, profile)
│   │   ├── api/                        # Route handlers (academic-setup, audit, blockchain, certificates, document-requests, grade-import, profile, reports, students, users)
│   │   ├── dashboard/page.tsx          # Role-redirect landing
│   │   ├── about/ sign-in/ sign-up/    # Public pages
│   │   └── verify-certificate/         # Public QR verification
│   ├── components/
│   │   ├── layout/
│   │   │   ├── portal-shell.tsx        # Sidebar + nav shell for portal
│   │   │   └── app-logo.tsx
│   │   ├── ui/                         # shadcn-style primitives
│   │   ├── academic-setup-manager.tsx
│   │   ├── grade-import-uploader.tsx
│   │   ├── student-record-actions.tsx / student-record-form.tsx
│   │   ├── request-form.tsx / request-status-actions.tsx
│   │   ├── generate-certificate-button.tsx
│   │   ├── retry-blockchain-button.tsx
│   │   ├── profile-update-form.tsx
│   │   ├── data-table.tsx / dashboard-card.tsx
│   │   ├── section-heading.tsx / status-badge.tsx
│   │   ├── motion-reveal.tsx
│   │   └── user-role-actions.tsx
│   ├── db/
│   │   ├── index.ts                    # Drizzle connector
│   │   └── schema.ts                   # All table definitions (see below)
│   ├── lib/
│   │   ├── auth.ts                     # Clerk + local DB user sync
│   │   ├── constants.ts / types.ts / utils.ts / validators.ts / email.ts / navigation.ts
│   │   ├── blockchain/
│   │   │   ├── abi.ts                  # Contract ABI
│   │   │   └── client.ts               # Ethers.js contract wrapper
│   │   ├── audit/                      # SHA-256 canonical hash helpers
│   │   └── services/                   # Business logic layer
│   │       ├── academic-setup.ts
│   │       ├── audit-log.ts
│   │       ├── certificates.ts
│   │       ├── document-requests.ts
│   │       ├── grade-import.ts
│   │       ├── live-data.ts
│   │       └── student-records.ts
│   └── proxy.ts                        # Clerk middleware for route protection
├── next.config.ts
├── drizzle.config.ts
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

---

## Database Schema (Tables)

| Table | Purpose |
|---|---|
| `users` | Clerk-synced users with local role (`admin/registrar/student/alumni`) |
| `schoolYears` | School year records with active flag |
| `gradeLevels` | Grade levels (ordered) |
| `sections` | Sections linked to grade level + school year |
| `students` | Student profiles linked to optional user account |
| `documentTypes` | Configurable document types with fees & requirements |
| `documentRequests` | Request submissions with tracking numbers & full status lifecycle |
| `requestStatusHistory` | Append-only status change audit trail |
| `subjects` | Subjects linked to grade level |
| `gradeImportBatches` | XLSX upload batches with blockchain proof fields |
| `studentGrades` | Per-student quarter grades per subject per year |
| `gradeImportErrors` | Per-row validation errors from an import batch |
| `certificates` | Generated Certificate of Grades with QR & blockchain proof |
| `notifications` | In-app notifications per user |
| `auditLogs` | Canonical action audit log with SHA-256 record hash |
| `blockchainAuditLogs` | On-chain submission tracking (pending/submitted/failed/verified, retry count) |

**Enums:** `user_role`, `account_status`, `student_type`, `student_status`, `request_status`, `blockchain_status`, `notification_type`

---

## User Roles & Portals

| Role | Portal Prefix | Key Capabilities |
|---|---|---|
| `admin` | `/admin/` | Users, document types, school years, grade levels, sections, subjects, settings, blockchain retry |
| `registrar` | `/registrar/` | Students, grade import, requests queue, certificate generation, reports, academic setup, audit logs |
| `student`/`alumni` | `/student/` | Submit requests, track status, notifications, profile |

---

## Blockchain Architecture

- **Contract:** `DocumentRequestAudit.sol` (Hardhat 3, Ethers.js v6)
- **Privacy rule:** Only stores `referenceType`, `referenceId`, `action`, `actorRole`, `recordHash`, `timestamp` — **no PII on-chain**
- **Flow:** Save locally → SHA-256 hash → attempt on-chain call → store tx hash if successful → leave as `pending` for admin retry if failed
- **Networks:** Local Hardhat node or Sepolia testnet

---

## Git History (last 10 commits)

| Hash | Message |
|---|---|
| `f80f72b` | Merge pull request #4 from EarlJan-coder/fix |
| `0c029b8` | code rabbit fix implement |
| `696119e` | Merge pull request #3 from EarlJan-coder/fix |
| `896a82c` | fix registrar page |
| `5c6a300` | Merge pull request #2 from EarlJan-coder/v2.1 |
| `e9fb279` | v2.1: Documents pdf download |
| `9c2d6bc` | Merge pull request #1 from EarlJan-coder/v2 |
| `30d2a2d` | V2 |
| `22075d3` | First Run |
| `7aa9ab1` | first commit |

---

## Notable Observations

> [!NOTE]
> The `git reset --hard` removed an experimental `apps/` and `packages/` directory tree — this codebase is a **flat single Next.js project**, not a monorepo. The open file `packages/shared/src/index.ts` referenced in your editor no longer exists on disk.

> [!NOTE]
> The schema has some redundant column pairs (e.g., `oldStatus`/`fromStatus`, `newStatus`/`toStatus` in `requestStatusHistory`; `importedByUserId`/`uploadedBy` in `gradeImportBatches`; `actorId`/`actorUserId` in `auditLogs`; `blockchainStatus`/`status` in `blockchainAuditLogs`). These appear to be artifacts of iterative development.

> [!NOTE]
> Three DB migrations exist (`0000–0002`). The app is Vercel-ready and uses `src/proxy.ts` (Clerk middleware) for route protection.
