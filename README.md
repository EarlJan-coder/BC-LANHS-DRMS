# LANHS DRMS

Luis Aguado National High School Student Records and Document Request Management System.

LANHS DRMS is a full-stack registrar portal for online document requests, student records, XLSX grade imports, Certificate of Grades PDF generation, QR verification, email notifications, and blockchain-backed audit proofs.

## Features

- Public landing page, Clerk sign-in/sign-up, and public certificate verification.
- Role dashboards for Admin, Registrar, and Student/Alumni.
- Local user role management backed by PostgreSQL.
- Student document request submission with tracking numbers, remarks, status timeline, notifications, email attempts, and audit logging.
- Registrar request queue with search/filter, status actions, certificate generation, ready/claimed workflow, and blockchain proof status.
- Student records, grade records, XLSX bulk grade import template, preview validation, error rows, duplicate detection, batch saving, and import audit proofs.
- Certificate of Grades records with PDF download, QR verification URL, public privacy-safe verification page, and blockchain hash proof.
- Admin user, document type, school year, grade level, section, subject, settings, and blockchain retry screens.
- Solidity smart contract and Hardhat workflow for local and Sepolia deployment.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS with shadcn-style local UI primitives
- Framer Motion for landing-page motion
- PostgreSQL and Drizzle ORM
- Clerk Authentication
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
src/lib/services/            Business logic for requests, grades, certificates, audits
src/lib/blockchain/          Ethers.js ABI and contract client
src/lib/audit/               Canonical JSON hashing helpers
contracts/                   Solidity contract
scripts/                     Seed and contract deployment scripts
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
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `SEPOLIA_RPC_URL`
- `CONTRACT_ADDRESS`
- `CERTIFICATE_SECRET`

The app also accepts the legacy aliases `BLOCKCHAIN_RPC_URL` and `DOCUMENT_AUDIT_CONTRACT_ADDRESS`.

## Local Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

When Clerk keys are missing, the app runs in demo mode for local review. When Clerk is configured, `src/proxy.ts` protects portal and API routes, `/dashboard` redirects by local database role, and role layouts prevent wrong-role access.

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

Seed sample data:

```bash
npm run db:seed
```

Seed data includes admin, registrar, student/alumni users, school years, grade levels, sections, subjects, document types, a sample student, a sample request, a grade import batch, and sample grades.

## Clerk Configuration

Use Clerk for authentication and configure the keys in `.env.local`.

The app syncs signed-in Clerk users into the local `users` table. Local database roles are authoritative after the row exists. Admins can update roles and statuses from `/admin/users`.

Role redirects:

- Admin: `/admin/dashboard`
- Registrar: `/registrar/dashboard`
- Student/Alumni: `/student/dashboard`

## Resend Email

Set:

```bash
RESEND_API_KEY=""
RESEND_FROM_EMAIL="LANHS DRMS <no-reply@example.com>"
```

Request submission, request updates, grade imports, and certificate generation attempt professional school-themed email notifications. Email failures do not roll back the main database transaction.

## XLSX Grade Import

Registrar workflow:

1. Go to `/registrar/grades/import`.
2. Download the XLSX template.
3. Fill the required columns.
4. Upload the file.
5. Review valid rows and error rows.
6. Save valid rows.

Validation checks include student matching, school year, grade level, section, subject, numeric grades, 0-100 grade range, duplicate rows in the file, and duplicate student-subject-school-year records already in the database.

## Certificate of Grades

Registrar workflow:

1. Open a Certificate of Grades request.
2. Generate the certificate.
3. Open `/registrar/certificates/[id]`.
4. Download the PDF.
5. Scan the QR code or open `/verify-certificate/[verificationCode]`.

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
npm run lint
npm run build
npm run chain:compile
```

## Deployment Notes

The project is Vercel-ready. Configure environment variables in Vercel, provision PostgreSQL, run migrations, seed initial configuration, configure Clerk URLs, verify Resend domain/sender settings, deploy the smart contract, and set `CONTRACT_ADDRESS`.
