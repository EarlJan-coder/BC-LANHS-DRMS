import { getDb } from "@/db";
import { certificates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildCanonicalCertificate } from "@/lib/audit/canonical";
import { createRecordHashFromCanonical } from "@/lib/audit/hash";
import { getRecordIndices, getAuditRecordFull, getLatestAuditRecord } from "@/lib/blockchain/client";
import type { OnChainAuditRecord } from "@/lib/blockchain/client";
import { ZERO_HASH } from "@/lib/utils";

export interface LifecycleEvent {
  eventType: string;
  action: string;
  recordHash: string;
  previousRecordHash: string;
  timestamp: number;
  recordedAt: string;
}

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
  eventTimeline?: LifecycleEvent[];
}

export async function verifyCertificateOnChain(certificateId: string): Promise<VerificationResult> {
  const db = getDb();
  if (!db) {
    return { valid: false, blockchainVerified: false, reason: "Database not available" };
  }

  const cert = await db.query.certificates.findFirst({ where: eq(certificates.id, certificateId) });
  if (!cert) return { valid: false, blockchainVerified: false, reason: "Certificate not found" };

  // Certificates must be linked to a student
  if (!cert.studentId) {
    return { valid: false, blockchainVerified: false, reason: "No student linked to certificate" };
  }

  // The school_year_id column was removed in the migration that dropped
  // academic structure, so the canonical hash is recomputed with an empty
  // school year. Existing certificates issued before the drop will not match
  // their original on-chain hash unless they are reissued.
  const schoolYearName = "";

  // Build canonical certificate
  const canonical = buildCanonicalCertificate({
    certificateNumber: cert.certificateNumber,
    studentId: cert.studentId,
    schoolYear: schoolYearName,
  });

  const computedHash = createRecordHashFromCanonical(canonical);

  // Fetch blockchain proof
  const indices = await getRecordIndices("certificate", cert.certificateNumber);
  if (indices.length === 0) {
    return { valid: false, blockchainVerified: false, reason: "No blockchain record found" };
  }

  const latest = await getLatestAuditRecord("certificate", cert.certificateNumber);
  if (!latest) {
    return { valid: false, blockchainVerified: false, reason: "Failed to read blockchain record" };
  }

  const matches = computedHash.toLowerCase() === latest.recordHash.toLowerCase();
  const network = process.env.BLOCKCHAIN_NETWORK ?? "unknown";

  // Build event timeline from all on-chain records
  const eventTimeline: LifecycleEvent[] = [];

  for (const idx of indices) {
    const record: OnChainAuditRecord | null = await getAuditRecordFull(idx);
    if (record && record.eventType) {
      eventTimeline.push({
        eventType: record.eventType,
        action: record.action,
        recordHash: record.recordHash,
        previousRecordHash: record.previousRecordHash === ZERO_HASH ? "" : record.previousRecordHash,
        timestamp: record.timestamp,
        recordedAt: new Date(record.timestamp * 1000).toISOString(),
      });
    }
  }

  // Sort by timestamp ascending for chronological order
  eventTimeline.sort((a, b) => a.timestamp - b.timestamp);

  return {
    valid: matches,
    blockchainVerified: true,
    transactionHash: cert.blockchainTxHash ?? undefined,
    recordedAt: new Date(latest.timestamp * 1000).toISOString(),
    action: latest.action,
    reason: matches ? undefined : "Record hash does not match blockchain proof",
    network,
    contractAddress: process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS,
    eventTimeline: eventTimeline.length > 0 ? eventTimeline : undefined,
  };
}
