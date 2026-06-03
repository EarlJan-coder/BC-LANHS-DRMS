# LANHS DRMS

Luis Aguado National High School Student Records and Document Request Management System.

This is a Vercel-ready full-stack capstone scaffold using Next.js, React, TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL, Clerk, Resend, Hardhat, Solidity, and Ethers.js.

## Core Modules

- Public pages: landing page, about page, login, registration
- Student / Alumni: dashboard, request submission, request history, request details, profile, notifications
- Registrar / Staff: request management, student records, grade management, bulk grade import, certificate generation, reports, audit logs
- Administrator: users, roles, document types, school years, grade levels, sections, subjects, blockchain audit trail, system settings
- Backend API routes: document requests, status updates, grade import template, grade import validation, grade import commit, audit verification, blockchain retry scaffold
- Blockchain: `contracts/DocumentRequestAudit.sol` stores only non-sensitive reference data and SHA-256 hash proofs

## Folder Structure

```text
src/app/                     Next.js App Router pages and API routes
src/app/(portal)/            Role-based dashboard routes
src/app/api/                 Backend route handlers
src/components/              Shared UI, layout, forms, and tables
src/db/                      Drizzle schema and database connector
src/lib/                     Constants, validators, auth, live data queries, services
src/lib/audit/               SHA-256 hash helpers
src/lib/blockchain/          Ethers.js contract ABI and client
contracts/                   Solidity smart contracts
scripts/                     Seed and deployment scripts
public/                      LANHS logo placeholder and static assets
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment variables:

```bash
cp .env.example .env.local
```

3. Fill in Clerk, PostgreSQL, Resend, and blockchain values in `.env.local`.

4. Generate and run database migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

## Blockchain Setup

Compile the contract:

```bash
npm run chain:compile
```

Start a local Hardhat node in another terminal:

```bash
npm run chain:node
```

Deploy the audit contract:

```bash
npm run chain:deploy
```

Copy the deployed address into `DOCUMENT_AUDIT_CONTRACT_ADDRESS`.

## Blockchain Privacy Rule

Never store student information, grades, documents, LRN, email, addresses, or private data on-chain.

The contract only accepts:

- `referenceId`
- `action`
- `actorRole`
- `recordHash`
- `timestamp`

If blockchain submission fails, the application saves the local audit record with a pending blockchain status so it can be retried later.

## Grade Import Columns

```text
LRN, Student Number, School Year, Grade Level, Section, Subject,
Quarter 1, Quarter 2, Quarter 3, Quarter 4, Final Grade, Remarks
```

The import flow validates required student identifiers, required academic fields, grade ranges, duplicate entries, and file type before saving records.

## Notes

- A real uploaded LANHS logo was not present in the workspace. `public/lanhs-logo.svg` is a clean placeholder based on the requested crimson/white identity and can be replaced with the official logo file.
- Protected routes use `src/proxy.ts` once Clerk environment variables are present.
- Portal dashboards and tables read live PostgreSQL data through Drizzle queries.
