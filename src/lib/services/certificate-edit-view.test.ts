import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { certificates } = await import("@/db/schema");
const { getCertificateEditView } = await import("@/lib/services/certificates");

const hasDb = Boolean(process.env.DATABASE_URL);
const insertedIds: string[] = [];

after(async () => {
  if (hasDb && insertedIds.length > 0) {
    const db = getDb();
    for (const id of insertedIds) {
      await db.delete(certificates).where(eq(certificates.id, id));
    }
  }
  await closeDb();
});

describe("getCertificateEditView signatory names (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("returns the typed signatory names and reports them as edited", async () => {
    const db = getDb();
    const [row] = await db
      .insert(certificates)
      .values({
        certificateNumber: `TEST-CERT-${Date.now()}-A`,
        verificationCode: `TEST-VERIF-${Date.now()}-A`,
        qrCodeData: "https://example.test/verify/a",
        certificateType: "good-moral",
        overrideRegistrarName: "Ana Reyes",
        overridePrincipalName: "Dr. Luis Ramos",
      })
      .returning();
    insertedIds.push(row.id);

    const view = await getCertificateEditView(row.id);
    assert.ok(view);
    assert.equal(view.registrarName, "Ana Reyes");
    assert.equal(view.principalName, "Dr. Luis Ramos");
    assert.equal(view.hasOverride.registrarName, true);
    assert.equal(view.hasOverride.principalName, true);
  });

  it("returns empty signatory names when none were typed", async () => {
    const db = getDb();
    const [row] = await db
      .insert(certificates)
      .values({
        certificateNumber: `TEST-CERT-${Date.now()}-B`,
        verificationCode: `TEST-VERIF-${Date.now()}-B`,
        qrCodeData: "https://example.test/verify/b",
        certificateType: "good-moral",
      })
      .returning();
    insertedIds.push(row.id);

    const view = await getCertificateEditView(row.id);
    assert.ok(view);
    assert.equal(view.registrarName, "");
    assert.equal(view.principalName, "");
    assert.equal(view.hasOverride.registrarName, false);
    assert.equal(view.hasOverride.principalName, false);
  });
});
