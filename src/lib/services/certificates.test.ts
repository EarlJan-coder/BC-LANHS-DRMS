import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { certificates, documentRequests } = await import("@/db/schema");
const { getCertificateView } = await import("@/lib/services/certificates");
const hasDb = Boolean(process.env.DATABASE_URL);
after(async () => { await closeDb(); });

describe("getCertificateView request linkage (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("returns the originating request id and null for manually generated certificates", async () => {
    const db = getDb();
    const [request] = await db.insert(documentRequests).values({
      trackingNumber: `CERT-REQ-${Date.now()}`,
      purpose: "Certificate linkage fixture",
    }).returning();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [linked] = await db.insert(certificates).values({
      certificateNumber: `CERT-LINK-${stamp}`,
      certificateType: "Test certificate",
      verificationCode: `LINK${stamp.replaceAll("-", "")}`,
      qrCodeData: "test",
      requestId: request.id,
    }).returning();
    const [manual] = await db.insert(certificates).values({
      certificateNumber: `CERT-MANUAL-${stamp}`,
      certificateType: "Manual certificate",
      verificationCode: `MANUAL${stamp.replaceAll("-", "")}`,
      qrCodeData: "test",
      requestId: null,
    }).returning();
    try {
      assert.equal((await getCertificateView(linked.id))?.requestId, request.id);
      assert.equal((await getCertificateView(manual.id))?.requestId, null);
    } finally {
      await db.delete(certificates).where(eq(certificates.id, linked.id));
      await db.delete(certificates).where(eq(certificates.id, manual.id));
      await db.delete(documentRequests).where(eq(documentRequests.id, request.id));
    }
  });
});
