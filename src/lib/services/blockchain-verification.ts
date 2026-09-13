import { getDb } from "@/db";
import { certificates, studentGrades, schoolYears } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildCanonicalCertificate } from "@/lib/audit/canonical";
import { createRecordHashFromCanonical } from "@/lib/audit/hash";
import { getRecordIndices, getLatestAuditRecord } from "@/lib/blockchain/client";

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
}

export async function verifyCertificateOnChain(certificateId: string): Promise<VerificationResult> {
  const db = getDb();
  if (!db) {
    return { valid: false, blockchainVerified: false, reason: "Database not available" };
  }

  const cert = await db.query.certificates.findFirst({ where: eq(certificates.id, certificateId) });
  if (!cert) return { valid: false, blockchainVerified: false, reason: "Certificate not found" };

  // Get student grades for this certificate
  if (!cert.studentId) {
    return { valid: false, blockchainVerified: false, reason: "No student linked to certificate" };
  }

  const grades = await db.query.studentGrades.findMany({
    where: eq(studentGrades.studentId, cert.studentId),
  });

  // Get school year name
  let schoolYearName = "";
  if (cert.schoolYearId) {
    const schoolYear = await db.query.schoolYears.findFirst({ where: eq(schoolYears.id, cert.schoolYearId) });
    schoolYearName = schoolYear?.name ?? "";
  }

  // Build canonical certificate
  const canonical = buildCanonicalCertificate({
    certificateNumber: cert.certificateNumber,
    studentId: cert.studentId,
    schoolYear: schoolYearName,
    grades: grades.map((g) => ({
      subjectCode: g.subjectId ?? "",
      quarter1: g.quarter1,
      quarter2: g.quarter2,
      quarter3: g.quarter3,
      quarter4: g.quarter4,
      finalGrade: g.finalGrade,
      remarks: g.remarks,
    })),
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

  return {
    valid: matches,
    blockchainVerified: true,
    transactionHash: cert.blockchainTxHash ?? undefined,
    recordedAt: new Date(latest.timestamp * 1000).toISOString(),
    action: latest.action,
    reason: matches ? undefined : "Record hash does not match blockchain proof",
    network,
    contractAddress: process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS,
  };
}