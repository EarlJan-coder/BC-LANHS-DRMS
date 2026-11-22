import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";
// Never talk to a real chain or send real email from tests: the blockchain
// client reads the zero address as "not configured" and answers without any
// network call, and email.ts disables itself without an API key (it reads
// RESEND_API_KEY at module load, so this must run before the imports below).
process.env.CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.RESEND_API_KEY = "";

const { eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { auditLogs, blockchainAuditLogs, certificates, documentRequests, notifications, requestStatusHistory, students, users } = await import("@/db/schema");
const { canAccessRequestSlip, createDocumentRequest, generateRequestSlipPdf, getRequestEligibility, truncateSlipLines, updateDocumentRequestStatus } = await import(
  "@/lib/services/document-requests"
);
const { generateCertificate } = await import("@/lib/services/certificates");
const { AppError } = await import("@/lib/utils");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

describe("truncateSlipLines", () => {
  it("keeps short blocks untouched", () => {
    assert.deepEqual(truncateSlipLines(["one", "two"], 5), ["one", "two"]);
  });

  it("clamps long blocks to the line budget and marks the cut", () => {
    const lines = Array.from({ length: 8 }, (_, index) => `line ${index}`);
    const clamped = truncateSlipLines(lines, 5);
    assert.equal(clamped.length, 5);
    assert.equal(clamped[0], "line 0");
    assert.ok(clamped[4].endsWith("…"), "the truncated block must show it was cut");
    assert.ok(!clamped[3].endsWith("…"));
  });

  it("leaves empty blocks empty", () => {
    assert.deepEqual(truncateSlipLines([], 5), []);
  });
});

describe("canAccessRequestSlip", () => {
  const owned = { requestedByUserId: "user-1", status: "ready_for_pickup" } as const;
  const notReady = { requestedByUserId: "user-1", status: "pending" } as const;
  const unowned = { requestedByUserId: null, status: "pending" } as const;

  it("lets the requesting user download their own slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-1", role: "student" }), true);
  });

  it("holds the requesting user's slip until the request is ready for pickup", () => {
    assert.equal(canAccessRequestSlip(notReady, { id: "user-1", role: "student" }), false);
  });

  it("denies one student another student's slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-2", role: "student" }), false);
  });

  it("lets registrars download any slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-9", role: "registrar" }), true);
  });

  it("lets registrars download a slip that is not ready for pickup", () => {
    assert.equal(canAccessRequestSlip(notReady, { id: "user-9", role: "registrar" }), true);
  });

  it("lets admins download any slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-9", role: "admin" }), true);
  });

  it("denies a student the slip for a staff-created request", () => {
    assert.equal(canAccessRequestSlip(unowned, { id: "user-2", role: "student" }), false);
  });

  it("lets staff download the slip for a staff-created request", () => {
    assert.equal(canAccessRequestSlip(unowned, { id: "user-9", role: "registrar" }), true);
  });
});

describe("generateRequestSlipPdf access (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("denies a student a staff-created slip but lets staff download it", async () => {
    const db = getDb();
    const [created] = await db
      .insert(documentRequests)
      .values({
        trackingNumber: `TEST-SLIP-${Date.now()}`,
        purpose: "Slip access test",
      })
      .returning();

    try {
      await assert.rejects(
        () => generateRequestSlipPdf(created.id, { id: "11111111-1111-1111-1111-111111111111", role: "student" }),
        /not found/i,
      );

      const pdf = await generateRequestSlipPdf(created.id, { id: "22222222-2222-2222-2222-222222222222", role: "registrar" });
      assert.ok(pdf.length > 0);
    } finally {
      await db.delete(documentRequests).where(eq(documentRequests.id, created.id));
    }
  });

  it("only lets the owner download once the request is ready for pickup", async () => {
    const db = getDb();
    const user = await createStudentUser("2025-2026");
    const [created] = await db
      .insert(documentRequests)
      .values({
        trackingNumber: `TEST-SLIP-STATUS-${Date.now()}`,
        purpose: "Slip readiness test",
        requestedByUserId: user.id,
        status: "pending",
      })
      .returning();

    try {
      // Downloading early is explained (403 + why), not disguised as a 404.
      await assert.rejects(
        () => generateRequestSlipPdf(created.id, { id: user.id, role: "student" }),
        (error: unknown) =>
          error instanceof AppError && error.status === 403 && /ready for pickup/i.test(error.message),
      );

      await db
        .update(documentRequests)
        .set({ status: "ready_for_pickup" })
        .where(eq(documentRequests.id, created.id));

      const pdf = await generateRequestSlipPdf(created.id, { id: user.id, role: "student" });
      assert.ok(pdf.length > 0);
    } finally {
      await db.delete(documentRequests).where(eq(documentRequests.id, created.id));
      await cleanupStudentUser(user.id);
    }
  });
});

async function createStudentUser(lastSchoolYearAttended: string | null) {
  fixtureIndex += 1;
  const db = getDb();
  const lrn = `9${String(Date.now() + fixtureIndex).slice(-11)}`;
  const [user] = await db
    .insert(users)
    .values({
      email: `req-eligibility-${Date.now()}-${fixtureIndex}@example.test`,
      lrn,
      passwordHash: "not-a-real-hash",
      firstName: "Jamie",
      lastName: "Santos",
      role: "student",
      registrationStatus: "approved",
    })
    .returning();
  await db.insert(students).values({
    userId: user.id,
    lrn,
    firstName: "Jamie",
    lastName: "Santos",
    lastSchoolYearAttended,
  });
  return user;
}

async function cleanupStudentUser(userId: string) {
  const db = getDb();
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(students).where(eq(students.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

const noopAudit = async () => ({
  recordHash: "0x0",
  blockchainStatus: "blockchain_pending" as const,
  blockchainTransactionHash: null,
  blockchainError: null,
  blockNumber: null,
  network: null,
});

/** Test seam: bypass cookie-bound auth, email, registrar fan-out, and audit. */
type UserRow = Awaited<ReturnType<typeof createStudentUser>>;
function testEffects(user: UserRow) {
  return {
    resolveUser: async () => user,
    resolveProfile: async () => ({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }),
    writeAudit: noopAudit,
    sendEmail: async () => ({ ok: true }),
    notifyRegistrars: async () => [],
  };
}

const requestPayload = {
  documentType: "Form 137",
  purpose: "College scholarship application requirement",
  gradeLevelNeeded: "12",
  strandNeeded: "ABM",
  sectionNeeded: "",
};

describe("last school year eligibility (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("blocks a student whose profile has no last school year attended", async () => {
    const user = await createStudentUser(null);
    try {
      const eligibility = await getRequestEligibility(user);
      assert.deepEqual(eligibility, { eligible: false, reason: "no_school_year" });
    } finally {
      await cleanupStudentUser(user.id);
    }
  });

  it("allows a student whose profile has a last school year attended", async () => {
    const user = await createStudentUser("2025-2026");
    try {
      const eligibility = await getRequestEligibility(user);
      assert.deepEqual(eligibility, { eligible: true, reason: null });
    } finally {
      await cleanupStudentUser(user.id);
    }
  });
});

describe("createDocumentRequest school year snapshot (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("copies the profile's last school year onto the request", async () => {
    const user = await createStudentUser("2025-2026");
    let createdId = "";
    try {
      const result = await createDocumentRequest(requestPayload, testEffects(user));
      createdId = result.id;
      const row = await getDb().query.documentRequests.findFirst({
        where: eq(documentRequests.id, result.id),
      });
      assert.equal(row?.schoolYearNeeded, "2025-2026");
      assert.equal(row?.requestedByUserId, user.id);
    } finally {
      if (createdId) {
        const db = getDb();
        await db.delete(requestStatusHistory).where(eq(requestStatusHistory.requestId, createdId));
        await db.delete(documentRequests).where(eq(documentRequests.id, createdId));
      }
      await cleanupStudentUser(user.id);
    }
  });

  it("throws 403 and creates nothing when the profile has no last school year", async () => {
    const user = await createStudentUser(null);
    try {
      await assert.rejects(
        () => createDocumentRequest(requestPayload, testEffects(user)),
        (error: unknown) =>
          error instanceof AppError && error.status === 403 && /last school year/i.test(error.message),
      );
      const rows = await getDb().select().from(documentRequests).where(eq(documentRequests.requestedByUserId, user.id));
      assert.equal(rows.length, 0);
    } finally {
      await cleanupStudentUser(user.id);
    }
  });
});

/** Removes a request with everything the approval flow writes around it. */
async function cleanupRequestArtifacts(requestId: string, referenceIds: string[], userId?: string) {
  const db = getDb();
  const certs = await db
    .select({ id: certificates.id, certificateNumber: certificates.certificateNumber })
    .from(certificates)
    .where(eq(certificates.requestId, requestId));
  const entityIds = [requestId, ...certs.map((cert) => cert.id)];
  const chainReferenceIds = [...referenceIds, ...certs.map((cert) => cert.certificateNumber)];

  await db.delete(blockchainAuditLogs).where(inArray(blockchainAuditLogs.referenceId, chainReferenceIds));
  await db.delete(auditLogs).where(inArray(auditLogs.entityId, entityIds));
  await db.delete(certificates).where(eq(certificates.requestId, requestId));
  await db.delete(requestStatusHistory).where(eq(requestStatusHistory.requestId, requestId));
  await db.delete(documentRequests).where(eq(documentRequests.id, requestId));
  if (userId) await cleanupStudentUser(userId);
}

describe("updateDocumentRequestStatus approval (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("generates the certificate automatically when the request is approved", async () => {
    const db = getDb();
    const user = await createStudentUser("2025-2026");
    const created = await createDocumentRequest(requestPayload, testEffects(user));

    try {
      const result = await updateDocumentRequestStatus(
        created.id,
        { status: "approved", remarks: "Status updated to approved.", registrarRemarks: "Registrar marked this request as approved." },
        "registrar",
      );
      assert.equal(result.status, "approved");

      const certs = await db.select().from(certificates).where(eq(certificates.requestId, created.id));
      assert.equal(certs.length, 1, "approving must generate exactly one certificate");
      assert.ok(certs[0].verificationCode, "generated certificate needs a verification code");
      assert.equal(result.certificateId, certs[0].id, "the caller needs the generated certificate's id");

      const student = await db.query.students.findFirst({ where: eq(students.userId, user.id) });
      assert.equal(certs[0].studentId, student?.id);

      const row = await db.query.documentRequests.findFirst({ where: eq(documentRequests.id, created.id) });
      assert.equal(row?.status, "approved");
    } finally {
      await cleanupRequestArtifacts(created.id, [created.trackingNumber], user.id);
    }
  });

  it("rolls the approval back when no student record is linked", async () => {
    const db = getDb();
    const trackingNumber = `TEST-APPROVE-${Date.now()}`;
    const [created] = await db
      .insert(documentRequests)
      .values({ trackingNumber, purpose: "Approval rollback test", status: "pending" })
      .returning();

    try {
      await assert.rejects(
        () =>
          updateDocumentRequestStatus(
            created.id,
            { status: "approved", remarks: "Status updated to approved.", registrarRemarks: "Registrar marked this request as approved." },
            "registrar",
          ),
        (error: unknown) => error instanceof AppError && /linked student record/i.test(error.message),
      );

      const row = await db.query.documentRequests.findFirst({ where: eq(documentRequests.id, created.id) });
      assert.equal(row?.status, "pending", "the approval must not stick when certificate generation fails");
      assert.equal(row?.approvedAt ?? null, null);

      const certs = await db.select().from(certificates).where(eq(certificates.requestId, created.id));
      assert.equal(certs.length, 0);

      const history = await db
        .select()
        .from(requestStatusHistory)
        .where(eq(requestStatusHistory.requestId, created.id));
      assert.equal(history.filter((entry) => entry.toStatus === "approved").length, 0);
    } finally {
      await cleanupRequestArtifacts(created.id, [trackingNumber]);
    }
  });

  it("does not issue a second certificate when a request with one is approved again", async () => {
    const db = getDb();
    const user = await createStudentUser("2025-2026");
    const created = await createDocumentRequest(requestPayload, testEffects(user));

    try {
      await generateCertificate({ requestId: created.id });
      await db
        .update(documentRequests)
        .set({ status: "processing" })
        .where(eq(documentRequests.id, created.id));

      await updateDocumentRequestStatus(
        created.id,
        { status: "approved", remarks: "Status updated to approved.", registrarRemarks: "Re-approved." },
        "registrar",
      );

      const certs = await db.select().from(certificates).where(eq(certificates.requestId, created.id));
      assert.equal(certs.length, 1, "re-approving must never mint a duplicate certificate");
    } finally {
      await cleanupRequestArtifacts(created.id, [created.trackingNumber], user.id);
    }
  });

  it("issues the missing certificate for a request approved before auto-generation existed", async () => {
    const db = getDb();
    const user = await createStudentUser("2025-2026");
    const created = await createDocumentRequest(requestPayload, testEffects(user));

    try {
      // Simulate a legacy row: already approved, certificate never generated.
      await db
        .update(documentRequests)
        .set({ status: "approved" })
        .where(eq(documentRequests.id, created.id));

      await updateDocumentRequestStatus(
        created.id,
        { status: "approved", remarks: "Status updated to approved.", registrarRemarks: "Backfilled." },
        "registrar",
      );

      const certs = await db.select().from(certificates).where(eq(certificates.requestId, created.id));
      assert.equal(certs.length, 1, "an approved request without a certificate must get one");
    } finally {
      await cleanupRequestArtifacts(created.id, [created.trackingNumber], user.id);
    }
  });
});
