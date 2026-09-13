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