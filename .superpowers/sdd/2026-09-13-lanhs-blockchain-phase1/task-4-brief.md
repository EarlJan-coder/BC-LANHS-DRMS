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
import { certificates, studentGrades, schoolYears, students, subjects } from '@/db/schema';
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