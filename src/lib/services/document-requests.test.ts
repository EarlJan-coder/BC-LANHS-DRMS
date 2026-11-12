import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { documentRequests, notifications, requestStatusHistory, students, users } = await import("@/db/schema");
const { canAccessRequestSlip, createDocumentRequest, generateRequestSlipPdf, getRequestEligibility } = await import(
  "@/lib/services/document-requests"
);
const { AppError } = await import("@/lib/utils");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

describe("canAccessRequestSlip", () => {
  const owned = { requestedByUserId: "user-1" };
  const unowned = { requestedByUserId: null };

  it("lets the requesting user download their own slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-1", role: "student" }), true);
  });

  it("denies one student another student's slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-2", role: "student" }), false);
  });

  it("lets registrars download any slip", () => {
    assert.equal(canAccessRequestSlip(owned, { id: "user-9", role: "registrar" }), true);
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
  strandNeeded: "Academic-Track",
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
