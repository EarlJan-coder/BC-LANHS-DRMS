import { eq } from "drizzle-orm";
import { auditLogs, blockchainAuditLogs, type UserRole } from "@/db/schema";
import { db } from "@/db";
import { createRecordHash } from "@/lib/audit/hash";
import { submitAuditToChain } from "@/lib/blockchain/client";

export type AuditedActionInput = {
  referenceType?: string;
  referenceId: string;
  action: string;
  actorRole: UserRole;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  hashMetadata?: Record<string, unknown>;
};

export async function recordAuditedAction(input: AuditedActionInput) {
  const timestamp = new Date().toISOString();
  const recordHash = createRecordHash({
    referenceId: input.referenceId,
    action: input.action,
    actorRole: input.actorRole,
    timestamp,
    metadata: input.hashMetadata,
  });

  const referenceType = input.referenceType ?? input.entityType;
  let blockchainLogId: string | undefined;

  if (db) {
    const [auditLog] = await db
      .insert(auditLogs)
      .values({
        actorId: input.actorUserId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        description: input.description,
        metadata: input.metadata,
        recordHash,
      })
      .returning();

    const [blockchainLog] = await db.insert(blockchainAuditLogs).values({
      auditLogId: auditLog.id,
      referenceType,
      referenceId: input.referenceId,
      action: input.action,
      actorId: input.actorUserId,
      actorRole: input.actorRole,
      recordHash,
      blockchainStatus: "pending",
      status: "pending",
    }).returning();
    blockchainLogId = blockchainLog.id;
  }

  const chainResult = await submitAuditToChain({
    referenceType,
    referenceId: input.referenceId,
    action: input.action,
    actorRole: input.actorRole,
    recordHash,
  });

  if (db && blockchainLogId) {
    await db
      .update(blockchainAuditLogs)
      .set({
        blockchainTxHash: chainResult.ok ? chainResult.transactionHash : undefined,
        contractAddress: chainResult.contractAddress,
        blockchainStatus: chainResult.ok ? "submitted" : "pending",
        status: chainResult.ok ? "submitted" : "pending",
        errorMessage: chainResult.ok ? undefined : chainResult.error,
        submittedAt: chainResult.ok ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(blockchainAuditLogs.id, blockchainLogId));
  }

  return {
    recordHash,
    blockchainStatus: chainResult.ok ? "submitted" : "blockchain_pending",
    blockchainTransactionHash: chainResult.ok ? chainResult.transactionHash : null,
    blockchainError: chainResult.ok ? null : chainResult.error,
  };
}

export async function retryPendingBlockchainLogs(limit = 25) {
  if (!db) {
    return { attempted: 0, submitted: 0, failed: 0 };
  }

  const pending = await db.query.blockchainAuditLogs.findMany({
    where: eq(blockchainAuditLogs.blockchainStatus, "pending"),
    limit,
  });

  let submitted = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await submitAuditToChain({
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      action: item.action,
      actorRole: item.actorRole,
      recordHash: item.recordHash,
    });

    if (result.ok) {
      submitted += 1;
    } else {
      failed += 1;
    }

    await db
      .update(blockchainAuditLogs)
      .set({
        blockchainTxHash: result.ok ? result.transactionHash : item.blockchainTxHash,
        contractAddress: result.contractAddress ?? item.contractAddress,
        blockchainStatus: result.ok ? "submitted" : "pending",
        status: result.ok ? "submitted" : "pending",
        errorMessage: result.ok ? undefined : result.error,
        retryCount: item.retryCount + 1,
        submittedAt: result.ok ? new Date() : item.submittedAt,
        updatedAt: new Date(),
      })
      .where(eq(blockchainAuditLogs.id, item.id));
  }

  return { attempted: pending.length, submitted, failed };
}
