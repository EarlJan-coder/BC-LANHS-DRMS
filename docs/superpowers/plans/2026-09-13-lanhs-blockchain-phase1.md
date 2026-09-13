# LANHS DRMS Blockchain Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 Core Attestation Foundation: database column cleanup, strict canonical hashing, contract refactor, verification service, verify page integration, blockchain metadata storage, and enhanced retry handling.

**Architecture:** PostgreSQL remains source of truth; blockchain serves as proof/attestation layer. We refactor the smart contract for efficient lookup, add canonical hashing for deterministic verification, create a verification service that compares DB state against on-chain records, and expose this on the public verify page with explorer links.

**Tech Stack:** Next.js 16, Drizzle ORM, PostgreSQL, Hardhat/Ethers v6, Solidity 0.8.28, TypeScript

## Global Constraints

- Target: `src/lib/audit/hash.ts` API must not break (`createRecordHash`, `verifyRecordHash` signatures unchanged)
- Contract gas: `addAuditRecord` < 100k gas
- Migrations must apply cleanly via `drizzle-kit migrate`
- All existing functionality (document requests, grade import, audit logging) must work after changes
- `npm run lint`, `npm run build`, `npm run chain:test` must pass
- Environment variables: `BLOCKCHAIN_RPC_URL`/`SEPOLIA_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, `CONTRACT_ADDRESS`/`DOCUMENT_AUDIT_CONTRACT_ADDRESS`, `NEXT_PUBLIC_APP_URL`, `BLOCKCHAIN_NETWORK`

---

### Task 1: Database Column Cleanup (Phase 1.1)

**Files:**
- Create: `drizzle/0003_cleanup_redundant_columns.sql`
- Modify: `src/db/schema.ts` (remove dropped columns from table definitions)
- Modify: `src/lib/services/audit-log.ts` (remove `status` column reference)
- Modify: `src/lib/services/grade-import.ts` (remove `uploadedBy` reference)
- Modify: `src/lib/services/document-requests.ts` (remove `oldStatus`/`changedBy` references)

**Interfaces:**
- Produces: Clean schema without redundant column pairs

- [ ] **Step 1: Create migration SQL**

```sql
-- drizzle/0003_cleanup_redundant_columns.sql
ALTER TABLE "request_status_history" DROP COLUMN "old_status";
ALTER TABLE "request_status_history" DROP COLUMN "changed_by";
ALTER TABLE "grade_import_batches" DROP COLUMN "uploaded_by";
ALTER TABLE "audit_logs" DROP COLUMN "actor_id";
ALTER TABLE "blockchain_audit_logs" DROP COLUMN "status";
```

- [ ] **Step 2: Update schema.ts**

```typescript
// requestStatusHistory: remove oldStatus, changedBy columns
// gradeImportBatches: remove uploadedBy column
// auditLogs: remove actorId column
// blockchainAuditLogs: remove status column
```

- [ ] **Step 3: Search and replace TypeScript references**

```bash
# Run these greps to find references:
grep -r "oldStatus\|changedBy\|uploadedBy\|actorId\b\|blockchainAuditLogs.*status" src/
```

Update all references to use the kept columns:
- `requestStatusHistory`: use `fromStatus`, `toStatus`, `actorUserId`
- `gradeImportBatches`: use `importedByUserId`
- `auditLogs`: use `actorUserId`
- `blockchainAuditLogs`: use `blockchainStatus`

- [ ] **Step 4: Run migration and verify**

```bash
npm run db:migrate
npm run db:studio
npm run lint
npm run build
```

---

### Task 2: Strict Canonical Hash Specification (Phase 1.2)

**Files:**
- Create: `src/lib/audit/canonical.ts`
- Modify: `src/lib/audit/hash.ts` (update `createRecordHash` to use canonical builders)
- Create: `src/lib/audit/canonical.test.ts` (unit tests)

**Interfaces:**
- Consumes: `AuditHashPayload` from `hash.ts`
- Produces: `buildCanonicalCertificate`, `buildCanonicalDocumentRequest`, `buildCanonicalGradeBatch`, `buildCanonicalStatusChange` functions returning typed canonical objects

- [ ] **Step 1: Write canonical builders with normalization rules**

```typescript
// src/lib/audit/canonical.ts
export interface CanonicalCertificate {
  certificateNumber: string;
  studentId: string;
  schoolYear: string; // YYYY-YYYY
  grades: CanonicalGrade[]; // sorted by subjectCode
}

export interface CanonicalGrade {
  subjectCode: string;
  quarter1: string | null; // "95.00" or null
  quarter2: string | null;
  quarter3: string | null;
  quarter4: string | null;
  finalGrade: string | null;
  remarks: string | null;
}

export interface CanonicalDocumentRequest {
  trackingNumber: string;
  documentType: string;
  status: string;
  schoolYearNeeded: string | null;
  gradeLevelNeeded: string | null;
}

export interface CanonicalGradeBatch {
  batchNumber: string;
  fileName: string;
  schoolYear: string;
  savedRows: number;
  unmatchedRows: number;
}

export interface CanonicalStatusChange {
  referenceId: string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
}

function normalizeDate(date: string | Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function normalizeNumber(num: number | string | null): string | null {
  if (num === null || num === undefined) return null;
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function normalizeString(str: string | null): string | null {
  if (!str) return null;
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sortByKey<T>(arr: T[], keyFn: (item: T) => string): T[] {
  return [...arr].sort((a, b) => keyFn(a).localeCompare(keyFn(b)));
}

export function buildCanonicalCertificate(data: {
  certificateNumber: string;
  studentId: string;
  schoolYear: string;
  grades: Array<{
    subjectCode: string;
    quarter1: number | string | null;
    quarter2: number | string | null;
    quarter3: number | string | null;
    quarter4: number | string | null;
    finalGrade: number | string | null;
    remarks: string | null;
  }>;
}): CanonicalCertificate {
  return {
    certificateNumber: data.certificateNumber,
    studentId: data.studentId,
    schoolYear: data.schoolYear,
    grades: sortByKey(data.grades.map(g => ({
      subjectCode: normalizeString(g.subjectCode) || '',
      quarter1: normalizeNumber(g.quarter1),
      quarter2: normalizeNumber(g.quarter2),
      quarter3: normalizeNumber(g.quarter3),
      quarter4: normalizeNumber(g.quarter4),
      finalGrade: normalizeNumber(g.finalGrade),
      remarks: normalizeString(g.remarks),
    })), 'subjectCode'),
  };
}

export function buildCanonicalDocumentRequest(data: {
  trackingNumber: string;
  documentType: string;
  status: string;
  schoolYearNeeded: string | null;
  gradeLevelNeeded: string | null;
}): CanonicalDocumentRequest {
  return {
    trackingNumber: data.trackingNumber,
    documentType: normalizeString(data.documentType) || '',
    status: normalizeString(data.status) || '',
    schoolYearNeeded: normalizeString(data.schoolYearNeeded),
    gradeLevelNeeded: normalizeString(data.gradeLevelNeeded),
  };
}

export function buildCanonicalGradeBatch(data: {
  batchNumber: string;
  fileName: string;
  schoolYear: string;
  savedRows: number;
  unmatchedRows: number;
}): CanonicalGradeBatch {
  return {
    batchNumber: data.batchNumber,
    fileName: data.fileName,
    schoolYear: data.schoolYear,
    savedRows: data.savedRows,
    unmatchedRows: data.unmatchedRows,
  };
}

export function buildCanonicalStatusChange(data: {
  referenceId: string;
  fromStatus: string;
  toStatus: string;
  actorRole: string;
}): CanonicalStatusChange {
  return {
    referenceId: data.referenceId,
    fromStatus: normalizeString(data.fromStatus) || '',
    toStatus: normalizeString(data.toStatus) || '',
    actorRole: normalizeString(data.actorRole) || '',
  };
}
```

- [ ] **Step 2: Update hash.ts to use canonical builders**

```typescript
// src/lib/audit/hash.ts - replace createRecordHash
import { 
  buildCanonicalCertificate,
  buildCanonicalDocumentRequest,
  buildCanonicalGradeBatch,
  buildCanonicalStatusChange,
} from './canonical';

export type RecordType = 'certificate' | 'document_request' | 'grade_import_batch' | 'status_change';

export interface TypedAuditHashPayload {
  recordType: RecordType;
  data: unknown; // Canonical* type based on recordType
}

export function createRecordHash(payload: TypedAuditHashPayload) {
  return `0x${createHash("sha256").update(stableJson(payload)).digest("hex")}`;
}

export function createRecordHashFromCanonical(canonical: unknown) {
  return `0x${createHash("sha256").update(stableJson(canonical)).digest("hex")}`;
}

// Keep verifyRecordHash signature for backward compatibility
export function verifyRecordHash(payload: AuditHashPayload, expectedHash: string) {
  return createRecordHash(payload).toLowerCase() === expectedHash.toLowerCase();
}
```

- [ ] **Step 3: Write unit tests**

```typescript
// src/lib/audit/canonical.test.ts
import { 
  buildCanonicalCertificate,
  buildCanonicalDocumentRequest,
  buildCanonicalGradeBatch,
  buildCanonicalStatusChange,
  createRecordHashFromCanonical,
} from './canonical';

describe('canonical hashing', () => {
  test('certificate: same input produces same hash', () => {
    const c1 = buildCanonicalCertificate({
      certificateNumber: 'CERT-20260912-ABC123',
      studentId: 'student-1',
      schoolYear: '2025-2026',
      grades: [
        { subjectCode: 'MATH', quarter1: 95, quarter2: 96, quarter3: 97, quarter4: 98, finalGrade: 96.5, remarks: 'Passed' },
        { subjectCode: 'ENG', quarter1: 90, quarter2: 91, quarter3: 92, quarter4: 93, finalGrade: 91.5, remarks: 'Passed' },
      ],
    });
    const c2 = buildCanonicalCertificate({
      certificateNumber: 'CERT-20260912-ABC123',
      studentId: 'student-1',
      schoolYear: '2025-2026',
      grades: [
        { subjectCode: 'ENG', quarter1: 90, quarter2: 91, quarter3: 92, quarter4: 93, finalGrade: 91.5, remarks: 'Passed' },
        { subjectCode: 'MATH', quarter1: 95, quarter2: 96, quarter3: 97, quarter4: 98, finalGrade: 96.5, remarks: 'Passed' },
      ],
    });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test('certificate: different order produces same hash', () => {
    const c1 = buildCanonicalCertificate({ ... });
    const c2 = buildCanonicalCertificate({ ... grades reversed ... });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test('certificate: number precision normalized', () => {
    const c1 = buildCanonicalCertificate({ grades: [{ subjectCode: 'MATH', finalGrade: 95, ... }] });
    const c2 = buildCanonicalCertificate({ grades: [{ subjectCode: 'MATH', finalGrade: '95.00', ... }] });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test('certificate: null vs omitted handled', () => {
    const c1 = buildCanonicalCertificate({ grades: [{ subjectCode: 'MATH', finalGrade: null, ... }] });
    const c2 = buildCanonicalCertificate({ grades: [{ subjectCode: 'MATH', finalGrade: undefined, ... }] });
    expect(createRecordHashFromCanonical(c1)).toBe(createRecordHashFromCanonical(c2));
  });

  test('document request: same input produces same hash', () => {
    const d1 = buildCanonicalDocumentRequest({ trackingNumber: 'REQ-123', documentType: 'Form 137', status: 'approved', schoolYearNeeded: '2025-2026', gradeLevelNeeded: 'Grade 10' });
    const d2 = buildCanonicalDocumentRequest({ trackingNumber: 'REQ-123', documentType: 'Form 137', status: 'approved', schoolYearNeeded: '2025-2026', gradeLevelNeeded: 'Grade 10' });
    expect(createRecordHashFromCanonical(d1)).toBe(createRecordHashFromCanonical(d2));
  });

  test('grade batch: same input produces same hash', () => {
    const g1 = buildCanonicalGradeBatch({ batchNumber: 'BATCH-1', fileName: 'grades.csv', schoolYear: '2025-2026', savedRows: 100, unmatchedRows: 2 });
    const g2 = buildCanonicalGradeBatch({ batchNumber: 'BATCH-1', fileName: 'grades.csv', schoolYear: '2025-2026', savedRows: 100, unmatchedRows: 2 });
    expect(createRecordHashFromCanonical(g1)).toBe(createRecordHashFromCanonical(g2));
  });

  test('status change: same input produces same hash', () => {
    const s1 = buildCanonicalStatusChange({ referenceId: 'REQ-123', fromStatus: 'pending', toStatus: 'approved', actorRole: 'registrar' });
    const s2 = buildCanonicalStatusChange({ referenceId: 'REQ-123', fromStatus: 'pending', toStatus: 'approved', actorRole: 'registrar' });
    expect(createRecordHashFromCanonical(s1)).toBe(createRecordHashFromCanonical(s2));
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/lib/audit/canonical.test.ts
```

- [ ] **Step 5: Update audit-log.ts to use canonical builders**

```typescript
// src/lib/services/audit-log.ts - update recordAuditedAction
import { 
  buildCanonicalCertificate,
  buildCanonicalDocumentRequest,
  buildCanonicalGradeBatch,
  buildCanonicalStatusChange,
  createRecordHashFromCanonical,
} from '@/lib/audit/canonical';

export async function recordAuditedAction(input: AuditedActionInput) {
  const timestamp = new Date().toISOString();
  
  let canonical;
  switch (input.referenceType) {
    case 'certificate':
      canonical = buildCanonicalCertificate(input.hashMetadata as any);
      break;
    case 'document_request':
      canonical = buildCanonicalDocumentRequest(input.hashMetadata as any);
      break;
    case 'grade_import_batch':
      canonical = buildCanonicalGradeBatch(input.hashMetadata as any);
      break;
    case 'status_change':
      canonical = buildCanonicalStatusChange(input.hashMetadata as any);
      break;
    default:
      canonical = {
        referenceId: input.referenceId,
        action: input.action,
        actorRole: input.actorRole,
        timestamp,
        metadata: input.hashMetadata,
      };
  }
  
  const recordHash = createRecordHashFromCanonical(canonical);
  // ... rest unchanged
}
```

---

### Task 3: Refactor DocumentRequestAudit.sol (Phase 1.3)

**Files:**
- Modify: `contracts/DocumentRequestAudit.sol`
- Modify: `src/lib/blockchain/abi.ts` (regenerate from artifact)
- Test: `test/DocumentRequestAudit.test.ts` (extend)

**Interfaces:**
- Produces: Updated contract with `getRecordIndices` and `getLatestAuditRecord` view functions

- [ ] **Step 1: Update Solidity contract**

```solidity
// contracts/DocumentRequestAudit.sol - already matches plan, verify it compiles
// The current contract already has the required functions from the plan
// Verify: getRecordIndices, getLatestAuditRecord exist
```

- [ ] **Step 2: Compile and test**

```bash
npm run chain:compile
npm run chain:test
```

- [ ] **Step 3: Deploy to local Hardhat node**

```bash
npm run chain:node &
npm run chain:deploy
# Update CONTRACT_ADDRESS in .env.local
```

- [ ] **Step 4: Regenerate ABI**

```bash
# Copy from artifacts/contracts/DocumentRequestAudit.sol/DocumentRequestAudit.json
# Update src/lib/blockchain/abi.ts with new ABI including getRecordIndices and getLatestAuditRecord
```

---

### Task 4: Application-Side Verification Service (Phase 1.4)

**Files:**
- Create: `src/lib/services/blockchain-verification.ts`
- Modify: `src/lib/blockchain/client.ts` (add read helpers)
- Create: `src/lib/services/blockchain-verification.test.ts`

**Interfaces:**
- Consumes: `buildCanonicalCertificate` from `canonical.ts`, contract ABI from `abi.ts`
- Produces: `verifyCertificateOnChain(certificateId)` returning `VerificationResult`

- [ ] **Step 1: Add read helpers to client.ts**

```typescript
// src/lib/blockchain/client.ts - add to existing file
export async function getRecordIndices(referenceType: string, referenceId: string): Promise<number[]> {
  const contract = getAuditContract();
  if (!contract) return [];
  try {
    const indices = await contract.getRecordIndices(referenceType, referenceId);
    return indices.map((i: any) => Number(i));
  } catch {
    return [];
  }
}

export async function getLatestAuditRecord(referenceType: string, referenceId: string) {
  const contract = getAuditContract();
  if (!contract) return null;
  try {
    const [refType, refId, action, actorRole, recordHash, timestamp] = 
      await contract.getLatestAuditRecord(referenceType, referenceId);
    return { referenceType: refType, referenceId: refId, action, actorRole, recordHash, timestamp: Number(timestamp) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create verification service**

```typescript
// src/lib/services/blockchain-verification.ts
import { getDb } from '@/db';
import { certificates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { buildCanonicalCertificate, createRecordHashFromCanonical } from '@/lib/audit/canonical';
import { getRecordIndices, getLatestAuditRecord } from '@/lib/blockchain/client';

export interface VerificationResult {
  valid: boolean;
  blockchainVerified: boolean;
  transactionHash?: string;
  recordedAt?: string;
  action?: string;
  reason?: string;
  blockNumber?: number;
  network?: string;
  contractAddress?: string;
}

export async function verifyCertificateOnChain(certificateId: string): Promise<VerificationResult> {
  const db = getDb();
  const cert = await db.query.certificates.findFirst({ where: eq(certificates.id, certificateId) });
  if (!cert) return { valid: false, blockchainVerified: false, reason: 'Certificate not found' };

  // Reconstruct canonical certificate
  const grades = await db.query.studentGrades.findMany({
    where: eq(studentGrades.studentId, cert.studentId),
    with: { subject: true, schoolYear: true },
  });

  const canonical = buildCanonicalCertificate({
    certificateNumber: cert.certificateNumber,
    studentId: cert.studentId,
    schoolYear: cert.schoolYearId ? (await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, cert.schoolYearId) }))?.name || '' : '',
    grades: grades.map(g => ({
      subjectCode: g.subject.code,
      quarter1: g.quarter1,
      quarter2: g.quarter2,
      quarter3: g.quarter3,
      quarter4: g.quarter4,
      finalGrade: g.finalGrade,
      remarks: g.remarks,
    })),
  });

  const computedHash = createRecordHashFromCanonical(canonical);

  // Fetch blockchain proof
  const indices = await getRecordIndices('certificate', cert.certificateNumber);
  if (indices.length === 0) {
    return { valid: false, blockchainVerified: false, reason: 'No blockchain record found' };
  }

  const latest = await getLatestAuditRecord('certificate', cert.certificateNumber);
  if (!latest) {
    return { valid: false, blockchainVerified: false, reason: 'Failed to read blockchain record' };
  }

  const matches = computedHash.toLowerCase() === latest.recordHash.toLowerCase();
  const network = process.env.BLOCKCHAIN_NETWORK ?? 'unknown';

  return {
    valid: matches,
    blockchainVerified: true,
    transactionHash: cert.blockchainTxHash ?? undefined,
    recordedAt: new Date(latest.timestamp * 1000).toISOString(),
    action: latest.action,
    reason: matches ? undefined : 'Record hash does not match blockchain proof',
    network,
    contractAddress: process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS,
  };
}
```

- [ ] **Step 3: Write integration tests**

```typescript
// src/lib/services/blockchain-verification.test.ts
import { verifyCertificateOnChain } from './blockchain-verification';

describe('verifyCertificateOnChain', () => {
  test('returns valid for known-good certificate', async () => {
    // Requires local Hardhat node with deployed contract
    // and a certificate that was submitted to chain
    const result = await verifyCertificateOnChain('test-cert-id');
    expect(result.valid).toBe(true);
    expect(result.blockchainVerified).toBe(true);
  });

  test('detects tampered certificate', async () => {
    // Modify DB record, verify hash mismatch
    const result = await verifyCertificateOnChain('tampered-cert-id');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('hash does not match');
  });

  test('graceful degradation when blockchain unavailable', async () => {
    // Temporarily unset BLOCKCHAIN_RPC_URL
    const result = await verifyCertificateOnChain('some-cert-id');
    expect(result.blockchainVerified).toBe(false);
    expect(result.reason).toContain('Blockchain not configured');
  });
});
```

---

### Task 5: Integrate Verification into Public Verify Page (Phase 1.5)

**Files:**
- Modify: `src/app/verify-certificate/[verificationCode]/page.tsx`
- Create: `src/components/BlockchainVerificationBadge.tsx`

**Interfaces:**
- Consumes: `verifyCertificateOnChain` from `blockchain-verification.ts`
- Produces: Updated verify page with blockchain status UI

- [ ] **Step 1: Create BlockchainVerificationBadge component**

```tsx
// src/components/BlockchainVerificationBadge.tsx
import { CheckCircle2, AlertCircle, Clock, ExternalLink } from 'lucide-react';

interface BlockchainVerificationBadgeProps {
  result: VerificationResult;
}

export function BlockchainVerificationBadge({ result }: BlockchainVerificationBadgeProps) {
  if (!result.blockchainVerified) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Blockchain proof pending
        </p>
        <p className="mt-1 text-sm">{result.reason ?? 'Certificate has not been submitted to blockchain yet.'}</p>
      </div>
    );
  }

  const isValid = result.valid;
  const explorerUrl = result.network === 'sepolia' 
    ? `https://sepolia.etherscan.io/tx/${result.transactionHash}`
    : result.network === 'hardhat'
    ? `http://localhost:8545/tx/${result.transactionHash}`
    : null;

  return (
    <div className={`rounded-md border p-4 ${
      isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
      : 'border-red-200 bg-red-50 text-red-800'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {isValid ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <p className="text-sm font-semibold">
          {isValid ? 'Hash matches on-chain record' : 'Hash mismatch detected'}
        </p>
      </div>
      <div className="grid gap-2 text-sm">
        {result.transactionHash && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Tx Hash:</span>
            <code className="break-all bg-slate-100 px-2 py-1 rounded">{result.transactionHash}</code>
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
                <ExternalLink className="h-3 w-3" />
                View on Etherscan
              </a>
            )}
          </div>
        )}
        {result.recordedAt && (
          <div>
            <span className="font-medium">Recorded:</span> {new Date(result.recordedAt).toLocaleString()}
          </div>
        )}
        {result.action && (
          <div>
            <span className="font-medium">Action:</span> {result.action}
          </div>
        )}
        {result.network && (
          <div>
            <span className="font-medium">Network:</span> {result.network}
          </div>
        )}
      </div>
      {!isValid && result.reason && (
        <p className="mt-2 text-sm">{result.reason}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update verify page**

```tsx
// src/app/verify-certificate/[verificationCode]/page.tsx
import { verifyCertificate } from '@/lib/services/certificates';
import { verifyCertificateOnChain } from '@/lib/services/blockchain-verification';
import { BlockchainVerificationBadge } from '@/components/BlockchainVerificationBadge';

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ verificationCode: string }>;
}) {
  const { verificationCode } = await params;
  const result = await verifyCertificate(verificationCode).catch(() => ({ valid: false }));
  
  let blockchainResult;
  if (result.valid && result.certificateNumber) {
    // Find certificate ID from certificateNumber
    const db = getDb();
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.certificateNumber, result.certificateNumber),
    });
    if (cert) {
      blockchainResult = await verifyCertificateOnChain(cert.id);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.valid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Certificate verification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className={...}>
              {/* existing validity badge */}
            </div>

            {result.valid ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {/* existing details */}
              </div>
            ) : null}

            {blockchainResult && (
              <BlockchainVerificationBadge result={blockchainResult} />
            )}

            <div className="flex gap-3 rounded-md bg-rose-50 p-4 text-sm text-brand">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Public verification does not expose full grades or private student information.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

---

### Task 6: Store Blockchain Metadata (Phase 1.6)

**Files:**
- Create: `drizzle/0004_add_blockchain_metadata.sql`
- Modify: `src/db/schema.ts` (add new columns)
- Modify: `src/lib/services/audit-log.ts` (capture block number, network)
- Modify: `src/lib/services/certificates.ts` (persist metadata from audit log)

**Interfaces:**
- Produces: New columns in `blockchainAuditLogs` and `certificates` tables

- [ ] **Step 1: Create migration**

```sql
-- drizzle/0004_add_blockchain_metadata.sql
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "block_number" bigint;
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "network" varchar(40);
-- contract_address already exists

ALTER TABLE "certificates" ADD COLUMN "block_number" bigint;
ALTER TABLE "certificates" ADD COLUMN "network" varchar(40);
```

- [ ] **Step 2: Update schema.ts**

```typescript
// blockchainAuditLogs
blockNumber: bigint("block_number"),
network: varchar("network", { length: 40 }),
// certificates
blockNumber: bigint("block_number"),
network: varchar("network", { length: 40 }),
```

- [ ] **Step 3: Update audit-log.ts to capture metadata**

```typescript
// In recordAuditedAction, after successful chain submission:
const receipt = await tx.wait();
const blockNumber = receipt.blockNumber;

await db.update(blockchainAuditLogs).set({
  blockchainTxHash: chainResult.transactionHash,
  contractAddress: chainResult.contractAddress,
  blockchainStatus: 'submitted',
  status: 'submitted',
  blockNumber,
  network: process.env.BLOCKCHAIN_NETWORK ?? 'unknown',
  submittedAt: new Date(),
  updatedAt: new Date(),
}).where(eq(blockchainAuditLogs.id, blockchainLogId));
```

- [ ] **Step 4: Update certificates.ts to persist metadata**

```typescript
// In generateCertificate, after audit:
await db.update(certificates).set({
  blockchainTxHash: audit.blockchainTransactionHash ?? undefined,
  recordHash: audit.recordHash,
  blockNumber: audit.blockNumber ?? undefined,
  network: audit.network ?? undefined,
  updatedAt: new Date(),
}).where(eq(certificates.id, created.id));
```

- [ ] **Step 5: Run migration and test**

```bash
npm run db:migrate
npm run lint
npm run build
```

---

### Task 7: Enhanced Pending/Retry Handling (Phase 1.7)

**Files:**
- Create: `drizzle/0005_add_retry_scheduling.sql`
- Modify: `src/db/schema.ts` (add retry scheduling columns)
- Modify: `src/lib/services/audit-log.ts` (exponential backoff)
- Modify: `src/app/admin/blockchain/page.tsx` (enhance admin UI)
- Create: `vercel.json` (optional cron)

**Interfaces:**
- Produces: Admin page with stats, per-row retry, exponential backoff

- [ ] **Step 1: Create migration**

```sql
-- drizzle/0005_add_retry_scheduling.sql
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "last_retry_at" timestamp with time zone;
ALTER TABLE "blockchain_audit_logs" ADD COLUMN "next_retry_at" timestamp with time zone;
```

- [ ] **Step 2: Update schema.ts**

```typescript
// blockchainAuditLogs
lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),
nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
```

- [ ] **Step 3: Implement exponential backoff in retryPendingBlockchainLogs**

```typescript
// src/lib/services/audit-log.ts
export async function retryPendingBlockchainLogs(limit = 25) {
  if (!db) return { attempted: 0, submitted: 0, failed: 0 };

  const now = new Date();
  const pending = await db.query.blockchainAuditLogs.findMany({
    where: and(
      eq(blockchainAuditLogs.blockchainStatus, 'pending'),
      // Only retry if nextRetryAt is null or in the past
      or(
        isNull(blockchainAuditLogs.nextRetryAt),
        lte(blockchainAuditLogs.nextRetryAt, now)
      )
    ),
    limit,
  });

  let submitted = 0;
  let failed = 0;

  for (const item of pending) {
    const retryCount = item.retryCount ?? 0;
    const result = await submitAuditToChain({ ... });

    const nextRetryDelay = Math.min(1000 * 60 * Math.pow(2, retryCount), 1000 * 60 * 60 * 24); // max 24h
    const nextRetryAt = result.ok ? null : new Date(now.getTime() + nextRetryDelay);

    await db.update(blockchainAuditLogs).set({
      blockchainTxHash: result.ok ? result.transactionHash : item.blockchainTxHash,
      contractAddress: result.contractAddress ?? item.contractAddress,
      blockchainStatus: result.ok ? 'submitted' : 'pending',
      status: result.ok ? 'submitted' : 'pending',
      errorMessage: result.ok ? undefined : result.error,
      retryCount: retryCount + 1,
      lastRetryAt: now,
      nextRetryAt,
      submittedAt: result.ok ? now : item.submittedAt,
      updatedAt: now,
    }).where(eq(blockchainAuditLogs.id, item.id));

    if (result.ok) submitted++; else failed++;
  }

  return { attempted: pending.length, submitted, failed };
}
```

- [ ] **Step 4: Enhance admin blockchain page**

```tsx
// src/app/admin/blockchain/page.tsx
import { BlockchainStatusTable, RetryAllButton, RetryStats } from '@/components/admin/blockchain';
```

- [ ] **Step 5: Create vercel.json for cron (optional)**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/blockchain/retry",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

### Task 8: Final Verification & Testing

**Files:** All modified files

**Interfaces:** End-to-end verification

- [ ] **Step 1: Run all verification commands**

```bash
npm run lint
npm run build
npm run db:migrate      # against test DB
npm run chain:test
```

- [ ] **Step 2: Manual verification**
1. Generate certificate via registrar UI
2. Wait for blockchain submission (or admin retry)
3. Visit `/verify-certificate/{code}`
4. Confirm blockchain status shows ✓ with tx hash + block number
5. Test admin retry with failed submission

---

## Definition of Done (Phase 1)

- [ ] All migrations apply cleanly
- [ ] Canonical hashing passes unit tests with reordering edge cases
- [ ] Contract deployed, lookup functions work
- [ ] `verifyCertificateOnChain` returns correct results for valid/tampered certs
- [ ] Public verify page shows blockchain status + explorer link
- [ ] Block number, network, contract address stored on submission
- [ ] Admin can retry pending/failed with backoff
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] `npm run chain:test` passes