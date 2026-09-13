# LANHS DRMS — Blockchain Architecture Suggestions

## Overview

The current LANHS DRMS blockchain architecture is already heading in a good direction:

> PostgreSQL transaction → canonical SHA-256 hash → blockchain submission → store transaction hash → retry if submission fails.

The recommended direction is to treat the blockchain primarily as a **proof/attestation layer**, rather than as the application's main transaction or data store.

The PostgreSQL database should remain the **source of truth**, while the blockchain should provide an immutable proof that a particular record or event existed with a particular state at a particular time.

---

## 1. Use the Blockchain as a Proof/Attestation System

Do not store actual student records, grades, certificates, or other sensitive data on-chain.

The existing privacy-oriented approach should be maintained:

- `referenceType`
- `referenceId`
- `action`
- `actorRole`
- `recordHash`
- `timestamp`

No personally identifiable information should be written to the blockchain.

### Recommended Architecture

```text
PostgreSQL
    │
    ├── Certificate data
    ├── Student information
    ├── Grades
    └── Generated PDF
           │
           ▼
     Canonical representation
           │
           ▼
        SHA-256 hash
           │
           ▼
     Blockchain contract
           │
           └── Record hash
```

The blockchain therefore proves the integrity of the record without exposing the underlying data.

---

## 2. Add Explicit Record Verification

The application should have a dedicated verification process.

For example:

```text
verifyCertificate(certificateId)
```

The verification flow should:

1. Retrieve the certificate from PostgreSQL.
2. Reconstruct its canonical representation.
3. Generate its SHA-256 hash.
4. Retrieve the corresponding blockchain proof.
5. Compare the newly generated hash with the blockchain hash.
6. Return the verification result.

### Example Successful Result

```ts
{
  valid: true,
  blockchainVerified: true,
  transactionHash: "...",
  recordedAt: "...",
  action: "CERTIFICATE_ISSUED"
}
```

### Example Failed Result

```ts
{
  valid: false,
  blockchainVerified: false,
  reason: "Record hash does not match blockchain proof"
}
```

This would integrate particularly well with the existing public `/verify-certificate/` page.

---

## 3. Clean Up Redundant Database Columns

Before adding more blockchain functionality, clean up the redundant column pairs created during iterative development.

Current examples include:

| Current Columns | Recommended |
|---|---|
| `oldStatus` / `fromStatus` | Keep `fromStatus` |
| `newStatus` / `toStatus` | Keep `toStatus` |
| `importedByUserId` / `uploadedBy` | Choose one consistent name |
| `actorId` / `actorUserId` | Choose one consistent name |
| `blockchainStatus` / `status` | Keep one `status` field |

### Example

A cleaner `requestStatusHistory` model:

```text
requestStatusHistory

id
requestId
fromStatus
toStatus
changedBy
createdAt
```

A cleaner `blockchainAuditLogs` model:

```text
blockchainAuditLogs

id
referenceType
referenceId
action
actorUserId
actorRole
recordHash
status
transactionHash
retryCount
createdAt
submittedAt
```

This will make the domain model easier to understand and maintain.

---

## 4. Separate Application Auditing from Blockchain Proof

The system effectively has two different auditing responsibilities.

### Application Audit

Answers:

> Who did what, when, and what changed?

Handled by PostgreSQL:

```text
auditLogs
requestStatusHistory
```

### Blockchain Proof

Answers:

> What exact record or event was cryptographically proven?

Handled by the blockchain:

```text
recordHash
transactionHash
blockNumber
timestamp
```

Keeping these responsibilities separate will make the architecture cleaner and easier to explain during the capstone defense.

---

## 5. Store More Blockchain Metadata

The current design stores the transaction hash when a blockchain submission succeeds.

Consider also storing:

```text
transactionHash
blockNumber
network
contractAddress
```

For example:

```text
Network: Sepolia Testnet
Contract: 0x...
Block: 9,123,456
Transaction: 0xabc...
```

A transaction hash identifies the transaction, while the block number provides additional blockchain context.

This information can also be displayed on the public certificate verification page.

---

## 6. Make Hash Generation Strictly Canonical

The hashing implementation should be deterministic.

Avoid relying on arbitrary serialization such as:

```ts
JSON.stringify(certificate)
```

unless deterministic ordering and normalization are guaranteed.

Instead, explicitly define the canonical representation.

For example:

```ts
const canonicalCertificate = {
  certificateNumber,
  studentId,
  schoolYear,
  grades: grades
    .sort(...)
    .map(...)
}
```

The canonicalization process should explicitly handle:

- Field ordering
- Array ordering
- Dates
- Numbers
- Strings
- Null values
- Other normalized representations

The resulting process should always be:

```text
Canonical data
      ↓
SHA-256
      ↓
Hash/digest
      ↓
Blockchain
```

This prevents false verification failures caused by differences in serialization rather than actual data changes.

---

## 7. Keep the Current Retry Architecture

The existing approach of allowing local operations to succeed even when blockchain submission fails should be retained.

Recommended flow:

```text
Student submits request
        ↓
PostgreSQL transaction
        ↓
Request successfully created
        ↓
Blockchain submission attempt
   ┌────┴────┐
   ↓         ↓
SUCCESS    FAILURE
   ↓         ↓
confirmed  pending
             ↓
        Admin retry
```

Do **not** make blockchain availability a hard prerequisite for creating a document request.

The school system should remain operational if the blockchain network, RPC endpoint, or testnet is temporarily unavailable.

---

## 8. Consider Event-Based Proofs

Instead of proving only the current state of a record, the system could prove significant lifecycle events.

For example:

```text
CERTIFICATE_ISSUED
CERTIFICATE_REISSUED
CERTIFICATE_VOIDED
CERTIFICATE_VERIFIED
```

Example:

```text
Certificate #CERT-2026-001

ISSUED
  hash → ABC
  tx → 0x123

REISSUED
  hash → DEF
  tx → 0x456

VOIDED
  hash → XYZ
  tx → 0x789
```

This changes the blockchain's role from simply proving that a certificate exists to providing an immutable proof of important state transitions.

This fits well with the existing append-only status history and audit-log architecture.

---

# Recommended Implementation Priority

The recommended order of work is:

1. **Clean the redundant database columns**
2. **Define one canonical hashing specification**
3. **Refine `DocumentRequestAudit.sol` around immutable attestations**
4. **Implement application-side blockchain verification**
5. **Integrate verification into `/verify-certificate/`**
6. **Store transaction hash, block number, network, and contract address**
7. **Improve pending/retry handling**
8. **Add event-based proofs for issuance, reissuance, and voiding**

---

# Target Architecture

```text
                 ┌─────────────────────┐
                 │     Next.js App     │
                 └──────────┬──────────┘
                            │
                     Business Logic
                            │
                 ┌──────────▼──────────┐
                 │     PostgreSQL      │
                 │   Source of Truth   │
                 └──────────┬──────────┘
                            │
                         SHA-256
                            │
                 ┌──────────▼──────────┐
                 │ Blockchain Service  │
                 │  Ethers.js / RPC   │
                 └──────────┬──────────┘
                            │
                 ┌──────────▼──────────┐
                 │ DocumentRequestAudit│
                 │      Solidity       │
                 └─────────────────────┘
                            │
                       Immutable
                          Proof
```

---



---

# 9. Clean and Simplify the Entire Codebase

Before considering the blockchain implementation complete, perform a **full codebase cleanup and simplification pass**.

The goal is not to change functionality unnecessarily. The goal is to make the project:

- Shorter
- Easier to read
- Easier to understand
- Easier to modify
- Easier to debug
- Less repetitive
- Less fragile
- Easier for future developers and capstone evaluators to maintain

## Cleanup Instructions

### Remove Unnecessary Files

Inspect the entire repository and remove files that are:

- Completely unused
- Dead code
- Leftovers from previous implementations
- Duplicate components
- Duplicate utilities
- Old experiments
- Deprecated implementations
- Empty files
- Unreferenced configuration files
- Files from the removed experimental monorepo structure
- Components that have been replaced but are still present
- Unused assets
- Unused API clients
- Unused blockchain implementations
- Unused types or schemas

**Do not delete a file simply because it appears unused at first glance.** Verify imports, routes, dynamic references, scripts, configuration references, and build requirements before removing it.

After cleanup, run the application and build process to ensure that nothing required was accidentally removed.

---

## Simplify the Code

Where functionality is duplicated or unnecessarily complicated:

```text
Before:
Multiple helpers
      ↓
Multiple wrappers
      ↓
Multiple transformations
      ↓
Actual operation
```

Prefer:

```text
After:
Small, focused helper
      ↓
Actual operation
```

Avoid abstraction for abstraction's sake.

A function does not need to be split into several files or wrappers if doing so makes the code harder to follow.

At the same time, avoid creating extremely large files containing unrelated responsibilities.

The target is **simple, focused, understandable code**.

---

## Reduce Repetition

Look for repeated:

- Database queries
- Validation logic
- Status handling
- Blockchain calls
- Error handling
- Hash generation
- Response formatting
- Authorization checks
- UI patterns
- Constants
- Type definitions

Consolidate genuinely identical logic into reusable utilities or services.

Do not create generic abstractions for code that is only coincidentally similar.

---

## Keep Naming Consistent

Use one naming convention for the same concept throughout the project.

For example, do not mix:

```text
actorId
actorUserId
userId
performedBy
performedByUser
```

if they all represent the same concept.

Choose the clearest name and use it consistently.

The same applies to:

```text
status
blockchainStatus
auditStatus
requestStatus
```

when the underlying concept is the same.

---

## Remove Overengineering

Prefer straightforward implementations over unnecessary design patterns.

Avoid:

- Unnecessary factories
- Unnecessary wrapper classes
- Deep abstraction layers
- Excessive interfaces
- Duplicate service layers
- Unnecessary state management
- Repeated adapter functions
- Functions that only call another function without adding value

For example, avoid:

```ts
function getCertificate(id: string) {
  return certificateService.getCertificate(id);
}
```

if the wrapper provides no meaningful behavior.

Prefer:

```ts
certificateService.getCertificate(id);
```

when appropriate.

---

## Keep Business Logic in the Service Layer

The current project already has a service-oriented structure.

Maintain that structure where it improves organization:

```text
src/lib/services/
```

Business logic should not unnecessarily be duplicated across:

- Page components
- API routes
- Server actions
- UI components
- Blockchain clients

A good structure is:

```text
UI
 ↓
API / Server Action
 ↓
Service
 ↓
Database / Blockchain
```

Keep each layer responsible for its own job.

---

## Simplify Components

React components should remain readable.

Avoid extremely large components containing:

- Database logic
- Authentication logic
- Blockchain logic
- Complex data transformation
- UI rendering
- Form validation
- Email logic

all in one file.

Extract logic only when extraction genuinely improves readability.

The goal is not to have the smallest possible number of lines at all costs.

The goal is:

> **Minimum necessary code with maximum clarity.**

---

## Remove Unused Dependencies

Inspect `package.json` and determine whether every dependency is actually required.

Remove packages that are:

- No longer imported
- Replaced by another package
- Leftovers from previous versions
- Only used by deleted code
- Unnecessary for the current implementation

After removing dependencies, reinstall and run the build/test process.

Do not remove a package solely because it is used infrequently.

---

## Review the Blockchain Code Specifically

The blockchain implementation should be particularly simple.

Aim for a structure similar to:

```text
contracts/
└── DocumentRequestAudit.sol

src/lib/blockchain/
├── abi.ts
└── client.ts

src/lib/audit/
└── hash helpers

src/lib/services/
└── audit/blockchain service
```

Avoid creating multiple overlapping blockchain clients or services.

There should ideally be one clear path for:

```text
Create proof
    ↓
Hash record
    ↓
Submit proof
    ↓
Store transaction information
    ↓
Verify proof
```

---

## Review the Repository After Cleanup

After the cleanup pass:

1. Search for unused imports.
2. Search for dead functions.
3. Search for duplicate types.
4. Search for duplicate utilities.
5. Search for unused components.
6. Search for obsolete comments.
7. Search for TODOs that are no longer relevant.
8. Search for old project names or paths.
9. Search for references to deleted files.
10. Review `package.json`.
11. Run linting.
12. Run TypeScript checks.
13. Run the production build.
14. Run database migrations against a test environment if applicable.
15. Test the blockchain integration.
16. Test certificate generation.
17. Test QR verification.
18. Test the blockchain retry flow.

---

## Important Cleanup Rule

**Do not rewrite working code merely to make it look different.**

Preserve existing behavior unless there is a clear reason to change it.

The cleanup should prioritize:

```text
Correctness
    ↓
Maintainability
    ↓
Readability
    ↓
Simplicity
    ↓
Shorter code
```

Shorter code is desirable, but **shorter does not automatically mean better**.

A clear 20-line function is better than a confusing 8-line function.

---

# Final Codebase Quality Target

After the cleanup, the project should feel like a deliberately designed system rather than a collection of features added over time.

The target should be:

```text
Clean repository
      ↓
Minimal necessary files
      ↓
Minimal necessary dependencies
      ↓
Consistent naming
      ↓
Low duplication
      ↓
Focused services
      ↓
Readable components
      ↓
Simple blockchain integration
      ↓
Easy future modification
```

The final codebase should be understandable enough that a new developer can open the repository and quickly determine:

- Where authentication happens
- Where database access happens
- Where business logic lives
- Where certificates are generated
- Where hashes are generated
- Where blockchain transactions are submitted
- Where blockchain verification happens
- Where API authorization happens
- Where the public certificate verification flow starts

**The objective is a clean, compact, maintainable capstone codebase — not merely a functioning one.**

# Final Recommendation

The strongest direction for LANHS DRMS is **not to move the school's records onto the blockchain**.

Instead:

> **PostgreSQL handles operational data and application auditing, while the blockchain provides tamper-evident integrity proofs for important records and events.**

The QR verification system can then independently verify whether the current certificate still matches the immutable blockchain proof.

This produces a clear and defensible architecture for the capstone:

```text
Operational Data
     ↓
PostgreSQL
     ↓
Canonicalization
     ↓
SHA-256
     ↓
Blockchain Proof
     ↓
QR Verification
     ↓
Integrity Result
```

The current codebase already contains much of the surrounding infrastructure needed for this direction, including certificate generation, SHA-256 audit helpers, blockchain services, retry functionality, audit logs, and public certificate verification.
