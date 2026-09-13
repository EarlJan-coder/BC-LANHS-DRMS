# LANHS DRMS — Blockchain Implementation Plan

**Version:** 1.0  
**Date:** 2026-09-12  
**Scope:** Phased implementation per architecture suggestions (core attestation → event proofs → cleanup)  
**Target:** Capstone-ready blockchain integration with PostgreSQL as source of truth, blockchain as proof/attestation layer

---

## Phase 1 — Core Attestation Foundation (Weeks 1–3)

### 1.1 Database Column Cleanup

**Goal:** Eliminate redundant column pairs from iterative development.

| Table | Current Redundant Pairs | Action |
|-------|------------------------|--------|
| `requestStatusHistory` | `oldStatus`/`fromStatus`, `newStatus`/`toStatus`, `changedBy`/`actorUserId` | Keep `fromStatus`, `toStatus`, `changedBy`; drop others |
| `gradeImportBatches` | `importedByUserId`/`uploadedBy` | Keep `importedByUserId`; drop `uploadedBy` |
| `auditLogs` | `actorId`/`actorUserId` | Keep `actorUserId`; drop `actorId` |
| `blockchainAuditLogs` | `blockchainStatus`/`status` | Keep `blockchainStatus`; drop `status` |

**Implementation Steps:**
1. Create migration `0003_cleanup_redundant_columns.sql` with `ALTER TABLE ... DROP COLUMN` statements
2. Update `src/db/schema.ts` to remove dropped columns from table definitions
3. Search and replace all TypeScript references to dropped columns (grep across codebase)
4. Update Drizzle relations if any reference the removed columns
5. Run migration locally, verify with `db:studio`, run existing tests

**Acceptance Criteria:**
- No TypeScript errors after migration
- All existing functionality works (document requests, grade import, audit logging)
- `drizzle-kit migrate` applies cleanly

---

### 1.2 Strict Canonical Hash Specification

**Goal:** Deterministic SHA-256 hashing that never produces false mismatches.

**Current Issue:** `stableJson` sorts object keys but doesn't normalize:
- Array element ordering (grades, subjects)
- Date formats (`2026-09-12T00:00:00Z` vs `2026-09-12`)
- Number precision (`95` vs `95.00`)
- Null vs omitted fields
- String trimming/case

**New `src/lib/audit/hash.ts` Specification:**

```typescript
// Canonical representation for each record type
interface CanonicalCertificate {
  certificateNumber: string;
  studentId: string;
  schoolYear: string;           // YYYY-YYYY format
  grades: CanonicalGrade[];     // Sorted by subjectCode ascending
}

interface CanonicalGrade {
  subjectCode: string;
  quarter1: string | null;      // "95.00" or null
  quarter2: string | null;
  quarter3: string | null;
  quarter4: string | null;
  finalGrade: string | null;
  remarks: string | null;
}

// Similar for: document request, grade batch, status change
```

**Normalization Rules:**
- Dates: ISO 8601 `YYYY-MM-DD` (no time, no timezone)
- Numbers: Fixed 2 decimal places as string (`"95.00"`), `null` for missing
- Strings: Trimmed, no double spaces, lowercased for codes
- Arrays: Sorted by a stable key (`subjectCode`, `certificateNumber`, etc.)
- Null values: Explicit `null` (not omitted)
- Objects: Keys sorted alphabetically

**Implementation Steps:**
1. Create `src/lib/audit/canonical.ts` with explicit canonical builders per record type
2. Update `createRecordHash` to accept typed payload + delegate to canonical builder
3. Add unit tests for each canonical form (same input → same hash; different order → same hash)
4. Add regression tests: ensure existing stored hashes still verify (one-time migration if needed)
5. Update `recordAuditedAction` in `audit-log.ts` to pass structured metadata to hash builder

**Acceptance Criteria:**
- Unit tests cover all record types with reordering edge cases
- Existing certificates/documents verify against stored blockchain hashes
- No breaking changes to `verifyRecordHash` signature

---

### 1.3 Refactor `DocumentRequestAudit.sol`

**Goal:** Contract focused on immutable attestations with richer metadata.

**Changes:**
1. Add `blockNumber`, `network`, `contractAddress` to emitted event (derived off-chain, stored in DB)
2. Keep storage minimal: `referenceType`, `referenceId`, `action`, `actorRole`, `recordHash`, `timestamp`
3. Add `getAuditRecordByReferenceTypeAndId` view for efficient verification lookup
4. Consider `enum ActionType` for type safety (optional)

**Updated Solidity:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentRequestAudit {
    struct AuditRecord {
        string referenceType;
        string referenceId;
        string action;
        string actorRole;
        bytes32 recordHash;
        uint256 timestamp;
    }

    AuditRecord[] private auditRecords;
    mapping(string => mapping(string => uint256[])) private indexByRef; // referenceType -> referenceId -> indices

    event AuditRecordAdded(
        uint256 indexed index,
        string referenceType,
        string referenceId,
        string action,
        string actorRole,
        bytes32 recordHash,
        uint256 timestamp
    );

    function addAuditRecord(...) external {
        uint256 index = auditRecords.length;
        auditRecords.push(AuditRecord({...}));
        indexByRef[referenceType][referenceId].push(index);
        emit AuditRecordAdded(index, referenceType, referenceId, action, actorRole, recordHash, block.timestamp);
    }

    function getAuditRecord(uint256 index) external view returns (...) { ... }

    function getRecordIndices(string calldata referenceType, string calldata referenceId)
        external view returns (uint256[] memory) {
        return indexByRef[referenceType][referenceId];
    }

    function getLatestAuditRecord(string calldata referenceType, string calldata referenceId)
        external view returns (string memory, string memory, string memory, string memory, bytes32, uint256) {
        uint256[] memory indices = indexByRef[referenceType][referenceId];
        if (indices.length == 0) revert("Not found");
        AuditRecord storage r = auditRecords[indices[indices.length - 1]];
        return (r.referenceType, r.referenceId, r.action, r.actorRole, r.recordHash, r.timestamp);
    }
}
```

**Implementation Steps:**
1. Update `contracts/DocumentRequestAudit.sol` with index mapping and lookup functions
2. Compile: `npm run chain:compile`
3. Run Hardhat tests: `npm run chain:test`
4. Deploy to Sepolia/local: `npm run chain:deploy`
5. Update `CONTRACT_ADDRESS` in `.env.local`
6. Regenerate ABI: update `src/lib/blockchain/abi.ts` (or auto-generate via Hardhat artifact)

**Acceptance Criteria:**
- Contract compiles, tests pass
- New lookup functions return correct data
- Gas costs reasonable (<100k gas per `addAuditRecord`)

---

### 1.4 Application-Side Verification Service

**Goal:** `verifyCertificate(certificateId)` that proves integrity against blockchain.

**New File:** `src/lib/services/blockchain-verification.ts`

```typescript
export interface VerificationResult {
  valid: boolean;
  blockchainVerified: boolean;
  transactionHash?: string;
  recordedAt?: string;
  action?: string;
  reason?: string;
}

export async function verifyCertificateOnChain(certificateId: string): Promise<VerificationResult> {
  const db = getDb();
  // 1. Fetch certificate from PostgreSQL
  const cert = await db.query.certificates.findFirst({ where: eq(certificates.id, certificateId) });
  if (!cert) return { valid: false, blockchainVerified: false, reason: "Certificate not found" };

  // 2. Reconstruct canonical representation
  const canonical = buildCanonicalCertificate(cert); // from canonical.ts
  const computedHash = createRecordHash(canonical);

  // 3. Fetch blockchain proof
  const chain = await getAuditContract();
  if (!chain) return { valid: true, blockchainVerified: false, reason: "Blockchain not configured" };

  // 4. Look up on-chain record by reference
  const indices = await chain.getRecordIndices("certificate", cert.certificateNumber);
  if (indices.length === 0) {
    return { valid: false, blockchainVerified: false, reason: "No blockchain record found" };
  }

  // 5. Compare latest on-chain hash
  const [, , , , onChainHash, timestamp] = await chain.getAuditRecord(indices[indices.length - 1]);
  const matches = computedHash.toLowerCase() === onChainHash.toLowerCase();

  return {
    valid: matches,
    blockchainVerified: true,
    transactionHash: cert.blockchainTxHash ?? undefined,
    recordedAt: new Date(Number(timestamp) * 1000).toISOString(),
    action: "CERTIFICATE_ISSUED",
    reason: matches ? undefined : "Record hash does not match blockchain proof",
  };
}
```

**Implementation Steps:**
1. Create `src/lib/services/blockchain-verification.ts` with above logic
2. Import `buildCanonicalCertificate` from `src/lib/audit/canonical.ts`
3. Add read-only contract call helper in `src/lib/blockchain/client.ts` (`getRecordIndices`, `getLatestAuditRecord`)
4. Write integration tests against local Hardhat node

**Acceptance Criteria:**
- Verification returns correct result for known-good certificate
- Verification detects tampered certificate (modify DB → hash mismatch)
- Works when blockchain RPC unavailable (returns `blockchainVerified: false` gracefully)

---

### 1.5 Integrate Verification into Public `/verify-certificate/` Page

**Goal:** Show blockchain verification status on the public QR verification page.

**Changes to `src/app/verify-certificate/[verificationCode]/page.tsx`:**
1. Call `verifyCertificateOnChain` instead of (or in addition to) current `verifyCertificate`
2. Display new UI section: "Blockchain Integrity Proof"
   - Green check: "Hash matches on-chain record"
   - Show transaction hash, block number (from DB), recorded timestamp
   - Link to block explorer (Sepolia Etherscan)
3. Keep existing "Valid certificate" badge for DB existence

**Implementation Steps:**
1. Update page to import and call `verifyCertificateOnChain`
2. Add `BlockchainVerificationBadge` component
3. Add block explorer URL builder (configurable network)
4. Style consistently with existing card layout

**Acceptance Criteria:**
- Page loads without error
- Shows blockchain status for certificates with on-chain proof
- Shows "Blockchain proof pending" for certificates not yet submitted
- Links to Etherscan work correctly

---

### 1.6 Store Blockchain Metadata

**Goal:** Persist `blockNumber`, `network`, `contractAddress` alongside transaction hash.

**Schema Changes (`src/db/schema.ts`):**

```typescript
// In blockchainAuditLogs
blockNumber: bigint("block_number"),
network: varchar("network", { length: 40 }), // "sepolia", "hardhat"
contractAddress: varchar("contract_address", { length: 60 }), // already exists

// In certificates
blockNumber: bigint("block_number"),
network: varchar("network", { length: 40 }),
```

**Implementation Steps:**
1. Create migration `0004_add_blockchain_metadata.sql`
2. Update `schema.ts` with new columns
3. Update `audit-log.ts` to capture `receipt.blockNumber`, `network` (from env), `contractAddress` on successful submission
4. Update `retryPendingBlockchainLogs` to also store block number
5. Update `certificates` insert/update in `certificates.ts` to persist metadata from audit log

**Acceptance Criteria:**
- New columns populated on successful blockchain submission
- Admin retry also populates metadata
- Verification page displays block number and network

---

### 1.7 Enhanced Pending/Retry Handling

**Goal:** Robust admin UI for retrying failed blockchain submissions.

**Current State:** `retry-blockchain-button.tsx` exists; `retryPendingBlockchainLogs` service works.

**Improvements:**
1. Add `lastRetryAt`, `nextRetryAt` columns to `blockchainAuditLogs` for exponential backoff
2. Admin page (`/admin/blockchain`) shows:
   - Pending count, failed count, last retry timestamp
   - "Retry All Pending" button with progress toast
   - Per-row retry with error details
3. Background job (optional): cron/vercel cron to auto-retry pending every 15 min

**Implementation Steps:**
1. Migration `0005_add_retry_scheduling.sql`
2. Update `retryPendingBlockchainLogs` to respect `nextRetryAt` and implement exponential backoff
3. Enhance `/admin/blockchain` page with stats and per-row controls
4. Add Vercel Cron config (`vercel.json`) for auto-retry (optional)

**Acceptance Criteria:**
- Admin can see all pending/failed submissions with error details
- Retry respects backoff, updates timestamps
- Auto-retry works if cron configured

---

## Phase 2 — Event-Based Proofs (Weeks 4–5)

### 2.1 On-Chain Lifecycle Events

**Goal:** Prove state transitions, not just final state.

**Events to Attest:**
| Event | Trigger | Canonical Payload |
|-------|---------|-------------------|
| `CERTIFICATE_ISSUED` | Certificate generated | Full certificate canonical form |
| `CERTIFICATE_REISSUED` | Certificate regenerated (same number) | New canonical form + previous hash |
| `CERTIFICATE_VOIDED` | Certificate marked void | Certificate number + void reason |
| `CERTIFICATE_VERIFIED` | Public verification succeeds | Verification code + timestamp + result |

**Contract Changes:**
- Add `eventType` field to `AuditRecord` (or separate event log)
- Store `previousRecordHash` for reissuance/voiding chain

**Implementation Steps:**
1. Extend `DocumentRequestAudit.sol` with `eventType` and `previousRecordHash`
2. Add `recordCertificateEvent(eventType, referenceId, recordHash, previousHash?)` function
3. Update `audit-log.ts` to call appropriate event type
4. Update certificate generation/voiding flow to emit events
5. Update verification to show event chain on `/verify-certificate/`

**Acceptance Criteria:**
- Each lifecycle transition creates on-chain record
- Verification page shows event timeline (ISSUED → REISSUED → VOIDED)
- Hash chain validates correctly

---

## Phase 3 — Codebase Cleanup & Simplification (Week 6)

### 3.1 Remove Unused/Dead Code

**Audit Checklist:**
- [ ] Unused components in `src/components/`
- [ ] Unused API routes in `src/app/api/`
- [ ] Dead functions in `src/lib/services/`
- [ ] Unused types in `src/lib/types.ts`
- [ ] Old experimental files (monorepo leftovers)
- [ ] Duplicate utilities (compare `utils.ts` vs `validators.ts` vs component helpers)

**Process:**
1. Run `npm run build` and `npm run lint` to find unused imports
2. Use `ts-prune` or manual grep for unreferenced exports
3. Verify no dynamic imports or config references before deleting
4. Delete in batches, run build after each batch

---

### 3.2 Simplify Code Structure

**Targets:**
- Collapse single-call wrapper functions (e.g., `getCertificate` → direct service call)
- Merge duplicate validation logic into shared validators
- Consolidate repeated blockchain submission code
- Flatten deep abstraction layers in `src/lib/services/`

**Rule:** Prefer straightforward implementations over unnecessary patterns.

---

### 3.3 Consistent Naming

**Renaming Pass:**
| Concept | Current Variants | Canonical |
|---------|------------------|-----------|
| Actor user ID | `actorId`, `actorUserId`, `userId`, `performedBy` | `actorUserId` |
| Status | `status`, `blockchainStatus`, `auditStatus`, `requestStatus` | Context-specific: `requestStatus`, `blockchainStatus` |

**Implementation:** Search/replace across codebase, update migrations if column names change.

---

### 3.4 Remove Unused Dependencies

**Review `package.json`:**
- [ ] `@types/qrcode` (used?)
- [ ] `framer-motion` (used in components?)
- [ ] `exceljs` vs `xlsx` (both needed?)
- [ ] `csv-parse` (used in grade import?)
- [ ] Any devDep not used in scripts

**Process:** Remove → `npm install` → `npm run build` → `npm run lint` → test suite.

---

### 3.5 Final Verification

Run full verification suite:

```bash
npm run lint
npm run build
npm run db:migrate      # against test DB
npm run chain:test
# Manual: test certificate generation → verify page → admin retry
```

**Deliverable:** Clean, passing, capstone-ready codebase.

---

## Cross-Cutting Concerns

### Testing Strategy
- Unit: canonical hashing, verification logic, canonical builders
- Integration: certificate generation → blockchain submission → verification page
- E2E: Playwright (optional) for happy path: request → approve → generate → verify

### Environment Variables
| Variable | Purpose | Required |
|----------|---------|----------|
| `BLOCKCHAIN_RPC_URL` / `SEPOLIA_RPC_URL` | RPC endpoint | Yes (for blockchain) |
| `BLOCKCHAIN_PRIVATE_KEY` | Signer wallet | Yes (for blockchain) |
| `CONTRACT_ADDRESS` / `DOCUMENT_AUDIT_CONTRACT_ADDRESS` | Deployed contract | Yes |
| `NEXT_PUBLIC_APP_URL` | Verification URL base | Yes |
| `BLOCKCHAIN_NETWORK` | "sepolia" \| "hardhat" (for metadata) | Yes |

### Documentation Updates
- Update `README.md` with blockchain architecture diagram
- Add `BLOCKCHAIN.md` with contract interaction guide
- Document canonical hash specification for future maintainers

---

## Milestones & Dependencies

```
Week 1: 1.1 DB cleanup → 1.2 Canonical hash (can start in parallel after 1.1 migration)
Week 2: 1.3 Contract refactor → 1.4 Verification service (depends on 1.2, 1.3)
Week 3: 1.5 Verify page integration → 1.6 Metadata → 1.7 Retry enhancements
Week 4: 2.1 Event-based proofs
Week 5: 2.1 continued + verification page timeline
Week 6: 3.1–3.5 Cleanup & final verification
```

**Critical Path:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing stored hashes break with new canonical form | Medium | High | Write one-time migration script to recompute & update DB hashes; verify against on-chain |
| Contract deployment fails on Sepolia | Low | Medium | Test on local Hardhat node first; keep fallback to local network |
| Verification page performance (blockchain RPC calls) | Medium | Low | Cache contract calls; add timeout; graceful degradation |
| Migration conflicts with existing data | Low | High | Test migrations on copy of production DB; use transactions |

---

## File-Level Change Summary

| File | Phase | Change Type |
|------|-------|-------------|
| `drizzle/0003_cleanup_redundant_columns.sql` | 1.1 | New migration |
| `drizzle/0004_add_blockchain_metadata.sql` | 1.6 | New migration |
| `drizzle/0005_add_retry_scheduling.sql` | 1.7 | New migration |
| `src/db/schema.ts` | 1.1, 1.6, 1.7 | Modify tables |
| `src/lib/audit/hash.ts` | 1.2 | Refactor (keep API) |
| `src/lib/audit/canonical.ts` | 1.2 | New file |
| `contracts/DocumentRequestAudit.sol` | 1.3, 2.1 | Refactor |
| `src/lib/blockchain/abi.ts` | 1.3 | Regenerate |
| `src/lib/blockchain/client.ts` | 1.3, 1.4 | Add read helpers |
| `src/lib/services/audit-log.ts` | 1.2, 1.6, 2.1 | Update hash + metadata |
| `src/lib/services/blockchain-verification.ts` | 1.4 | New file |
| `src/lib/services/certificates.ts` | 1.5, 1.6, 2.1 | Update verification + events |
| `src/app/verify-certificate/[verificationCode]/page.tsx` | 1.5, 2.1 | UI + verification |
| `src/components/retry-blockchain-button.tsx` | 1.7 | Enhance |
| `src/app/admin/blockchain/page.tsx` | 1.7 | New/Enhance admin UI |
| `vercel.json` | 1.7 | Optional cron config |
| Various cleanup | 3.1–3.4 | Delete/rename/refactor |

---

## Definition of Done (Per Phase)

### Phase 1 Complete When:
- [ ] All migrations apply cleanly
- [ ] Canonical hashing passes unit tests with reordering edge cases
- [ ] Contract deployed, lookup functions work
- [ ] `verifyCertificateOnChain` returns correct results for valid/tampered certs
- [ ] Public verify page shows blockchain status + explorer link
- [ ] Block number, network, contract address stored on submission
- [ ] Admin can retry pending/failed with backoff

### Phase 2 Complete When:
- [ ] Lifecycle events emitted on-chain for issue/reissue/void/verify
- [ ] Verification page displays event timeline
- [ ] Hash chain validates across events

### Phase 3 Complete When:
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` succeeds
- [ ] No unused files/dependencies remain
- [ ] Naming consistent across codebase
- [ ] All tests pass
- [ ] Documentation updated

---

## Appendix: Quick Reference Commands

```bash
# DB migrations
npm run db:generate
npm run db:migrate
npm run db:studio

# Blockchain
npm run chain:compile
npm run chain:test
npm run chain:node          # local Hardhat
npm run chain:deploy        # to Sepolia/local

# App
npm run dev
npm run build
npm run lint

# Verification (manual)
# 1. Generate certificate via registrar UI
# 2. Wait for blockchain submission (or admin retry)
# 3. Visit /verify-certificate/{code}
# 4. Confirm blockchain status shows ✓ with tx hash + block number
```