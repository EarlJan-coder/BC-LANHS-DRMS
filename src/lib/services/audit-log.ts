import { and, eq, isNull, lte, or } from "drizzle-orm";
import { auditLogs, blockchainAuditLogs, type UserRole } from "@/db/schema";
import { db } from "@/db";
import { createRecordHashFromCanonical } from "@/lib/audit/hash";
import {
  buildCanonicalCertificate,
  buildCanonicalDocumentRequest,
  buildCanonicalGradeBatch,
  buildCanonicalStatusChange,
} from "@/lib/audit/canonical";
import { submitAuditToChain, submitLifecycleEventToChain } from "@/lib/blockchain/client";

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
  eventType?: string;
  previousRecordHash?: string;
};

export async function recordAuditedAction(input: AuditedActionInput) {
  const timestamp = new Date().toISOString();

  let canonical;
  switch (input.referenceType) {
    case "certificate":
      canonical = buildCanonicalCertificate(input.hashMetadata as Parameters<typeof buildCanonicalCertificate>[0]);
      break;
    case "document_request":
      canonical = buildCanonicalDocumentRequest(input.hashMetadata as Parameters<typeof buildCanonicalDocumentRequest>[0]);
      break;
    case "grade_import_batch":
      canonical = buildCanonicalGradeBatch(input.hashMetadata as Parameters<typeof buildCanonicalGradeBatch>[0]);
      break;
    case "status_change":
      canonical = buildCanonicalStatusChange(input.hashMetadata as Parameters<typeof buildCanonicalStatusChange>[0]);
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

  const referenceType = input.referenceType ?? input.entityType;
  let blockchainLogId: string | undefined;

  if (db) {
    const [auditLog] = await db
      .insert(auditLogs)
      .values({
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
      actorRole: input.actorRole,
      recordHash,
      blockchainStatus: "pending",
    }).returning();
    blockchainLogId = blockchainLog.id;
  }

  let chainResult;
  if (input.eventType) {
    chainResult = await submitLifecycleEventToChain({
      eventType: input.eventType,
      referenceId: input.referenceId,
      action: input.action,
      actorRole: input.actorRole,
      recordHash,
      previousRecordHash: input.previousRecordHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    });
  } else {
    chainResult = await submitAuditToChain({
      referenceType,
      referenceId: input.referenceId,
      action: input.action,
      actorRole: input.actorRole,
      recordHash,
    });
  }

  if (db && blockchainLogId) {
    await db
      .update(blockchainAuditLogs)
      .set({
        blockchainTxHash: chainResult.ok ? chainResult.transactionHash : undefined,
        contractAddress: chainResult.contractAddress,
        blockchainStatus: chainResult.ok ? "submitted" : "pending",
        blockNumber: chainResult.ok ? chainResult.blockNumber : undefined,
        network: chainResult.ok ? (process.env.BLOCKCHAIN_NETWORK ?? "unknown") : undefined,
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
    blockNumber: chainResult.ok ? chainResult.blockNumber : null,
    network: chainResult.ok ? (process.env.BLOCKCHAIN_NETWORK ?? "unknown") : null,
  };
}

export async function retryPendingBlockchainLogs(limit = 25) {
  if (!db) {
    return { attempted: 0, submitted: 0, failed: 0 };
  }

  const now = new Date();
  const pending = await db.query.blockchainAuditLogs.findMany({
    where: and(
      eq(blockchainAuditLogs.blockchainStatus, "pending"),
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

    const nextRetryDelay = Math.min(
      1000 * 60 * Math.pow(2, retryCount),
      1000 * 60 * 60 * 24
    );
    const nextRetryAt = result.ok ? null : new Date(now.getTime() + nextRetryDelay);

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
        blockNumber: result.ok ? result.blockNumber : item.blockNumber,
        network: result.ok ? (process.env.BLOCKCHAIN_NETWORK ?? item.network) : item.network,
        errorMessage: result.ok ? undefined : result.error,
        retryCount: retryCount + 1,
        lastRetryAt: now,
        nextRetryAt,
        submittedAt: result.ok ? now : item.submittedAt,
        updatedAt: now,
      })
      .where(eq(blockchainAuditLogs.id, item.id));
  }

  return { attempted: pending.length, submitted, failed };
}
