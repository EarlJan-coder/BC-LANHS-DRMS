import { auditLogs, blockchainAuditLogs, type UserRole } from "@/db/schema";
import { db } from "@/db";
import { createRecordHash } from "@/lib/audit/hash";
import { submitAuditToChain } from "@/lib/blockchain/client";

export type AuditedActionInput = {
  referenceId: string;
  action: string;
  actorRole: UserRole;
  entityType: string;
  entityId: string;
  actorUserId?: string;
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

  const chainResult = await submitAuditToChain({
    referenceId: input.referenceId,
    action: input.action,
    actorRole: input.actorRole,
    recordHash,
  });

  if (db) {
    const [auditLog] = await db
      .insert(auditLogs)
      .values({
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        recordHash,
      })
      .returning();

    await db.insert(blockchainAuditLogs).values({
      auditLogId: auditLog.id,
      referenceId: input.referenceId,
      action: input.action,
      actorRole: input.actorRole,
      recordHash,
      blockchainTxHash: chainResult.ok ? chainResult.transactionHash : undefined,
      contractAddress: chainResult.contractAddress,
      status: chainResult.ok ? "submitted" : "pending",
      errorMessage: chainResult.ok ? undefined : chainResult.error,
      submittedAt: chainResult.ok ? new Date() : undefined,
    });
  }

  return {
    recordHash,
    blockchainStatus: chainResult.ok ? "submitted" : "blockchain_pending",
    blockchainTransactionHash: chainResult.ok ? chainResult.transactionHash : null,
    blockchainError: chainResult.ok ? null : chainResult.error,
  };
}

