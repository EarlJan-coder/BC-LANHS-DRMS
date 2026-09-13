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