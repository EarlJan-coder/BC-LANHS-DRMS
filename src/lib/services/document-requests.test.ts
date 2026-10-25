import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { documentRequests } = await import("@/db/schema");
const { canAccessRequestSlip, generateRequestSlipPdf } = await import("@/lib/services/document-requests");

const hasDb = Boolean(process.env.DATABASE_URL);

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
