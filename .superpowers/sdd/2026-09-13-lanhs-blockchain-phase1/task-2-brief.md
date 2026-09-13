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