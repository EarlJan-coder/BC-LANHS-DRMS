import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.RESEND_API_KEY = "";

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { auditLogs, blockchainAuditLogs, certificates, documentRequests, notifications, requestStatusHistory, students, users } = await import("@/db/schema");
const { buildCanonicalCertificate, certificateHashMetadata } = await import("@/lib/audit/canonical");
const { createRecordHashFromCanonical } = await import("@/lib/audit/hash");
const { generateCertificate } = await import("@/lib/services/certificates");
const { certificateProofMatches } = await import("@/lib/services/blockchain-verification");

const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => closeDb());

describe("certificate blockchain proof matching", () => {
  it("accepts a matching historical proof even when the latest proof differs", () => {
    assert.equal(certificateProofMatches("0xMATCH", ["0xold", "0xmatch", "0xlatest"]), true);
  });
});

describe("certificate issuance hash metadata (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("includes the request's school year in the issued certificate hash", async () => {
    const db = getDb();
    const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lrn = `8${tag.replace(/\D/g, "").slice(-11).padStart(11, "0")}`;
    const [user] = await db.insert(users).values({ email: `verify-${tag}@example.test`, lrn, passwordHash: "not-a-real-hash", firstName: "Jamie", lastName: "Santos", role: "student", registrationStatus: "approved" }).returning();
    const [student] = await db.insert(students).values({ userId: user.id, lrn, firstName: "Jamie", lastName: "Santos", lastSchoolYearAttended: "2025-2026" }).returning();
    const [request] = await db.insert(documentRequests).values({ trackingNumber: `VERIFY-${tag}`, studentId: student.id, requestedByUserId: user.id, purpose: "Certificate hash verification fixture", schoolYearNeeded: "2025-2026", status: "approved" }).returning();
    let certificateId = "";
    let certificateNumber = "";

    try {
      const generated = await generateCertificate({ requestId: request.id });
      certificateId = generated.id;
      certificateNumber = generated.certificateNumber;
      const certificate = await db.query.certificates.findFirst({ where: eq(certificates.id, certificateId) });
      const joined = await db.select({ cert: certificates, schoolYearNeeded: documentRequests.schoolYearNeeded })
        .from(certificates)
        .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
        .where(eq(certificates.id, certificateId))
        .limit(1);
      assert.ok(certificate && joined[0]);
      const verificationMetadata = certificateHashMetadata({
        certificateNumber: joined[0].cert.certificateNumber,
        studentId: joined[0].cert.studentId,
        schoolYearNeeded: joined[0].schoolYearNeeded,
      });
      assert.equal(createRecordHashFromCanonical(buildCanonicalCertificate(verificationMetadata)), certificate.recordHash);
    } finally {
      if (certificateNumber) await db.delete(blockchainAuditLogs).where(eq(blockchainAuditLogs.referenceId, certificateNumber));
      await db.delete(auditLogs).where(eq(auditLogs.entityId, certificateId));
      if (certificateId) await db.delete(certificates).where(eq(certificates.id, certificateId));
      await db.delete(notifications).where(eq(notifications.userId, user.id));
      await db.delete(requestStatusHistory).where(eq(requestStatusHistory.requestId, request.id));
      await db.delete(documentRequests).where(eq(documentRequests.id, request.id));
      await db.delete(students).where(eq(students.id, student.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  });
});
