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
import { and, eq, isNull, lte, or } from 'drizzle-orm';

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
    const result = await submitAuditToChain({ 
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      action: item.action,
      actorRole: item.actorRole,
      recordHash: item.recordHash,
    });

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