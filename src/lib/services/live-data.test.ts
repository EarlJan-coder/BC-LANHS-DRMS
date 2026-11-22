import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { auditLogs, documentRequests } = await import("@/db/schema");
const { getDocumentRequestView, listDocumentRequestViews, listLocalAuditTrailViews } = await import("@/lib/services/live-data");

const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  await closeDb();
});

describe("live detail queries (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("detail view resolves a request past the old 100-row cap", async () => {
    const runTag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const rows = Array.from({ length: 101 }, (_, index) => ({
      trackingNumber: `LIVE-${runTag}-${index}`,
      purpose: "Fixture for indexed detail lookup",
      ...(index === 100 ? { createdAt: new Date("2000-01-01T00:00:00.000Z") } : {}),
    }));
    const inserted = await getDb().insert(documentRequests).values(rows).returning({ id: documentRequests.id, trackingNumber: documentRequests.trackingNumber });
    const target = inserted[100];

    try {
      const view = await getDocumentRequestView(target.id);
      assert.equal(view?.id, target.id);
      assert.equal(view?.trackingNumber, target.trackingNumber);
    } finally {
      await getDb().delete(documentRequests).where(inArray(documentRequests.id, inserted.map((row) => row.id)));
    }
  });

  it("request listing returns a counted filtered page from the database", async () => {
    const runTag = `PAGE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const inserted = await getDb().insert(documentRequests).values(
      Array.from({ length: 3 }, (_, index) => ({
        trackingNumber: `${runTag}-${index}`,
        purpose: `Pagination fixture ${runTag}`,
      })),
    ).returning({ id: documentRequests.id });

    try {
      const result = await listDocumentRequestViews({ page: 2, pageSize: 2, q: runTag });
      assert.equal(result.total, 3);
      assert.equal(result.page, 2);
      assert.equal(result.pageSize, 2);
      assert.equal(result.rows.length, 1);
      assert.ok(result.rows[0].trackingNumber.startsWith(runTag));
    } finally {
      await getDb().delete(documentRequests).where(inArray(documentRequests.id, inserted.map((row) => row.id)));
    }
  });

  it("local audit fallback lists only blockchain-relevant actions", async () => {
    const { randomUUID } = await import("node:crypto");
    const db = getDb();
    const recordHash = (id: string) => `0x${id.replace(/-/g, "").padEnd(64, "0")}`;
    const seedRows: Array<{ id: string; actorRole: "student" | "registrar" | "admin"; action: string; entityType: string }> = [
      { id: randomUUID(), actorRole: "admin", action: "user.create", entityType: "user" },
      { id: randomUUID(), actorRole: "admin", action: "update_settings", entityType: "system_settings" },
      { id: randomUUID(), actorRole: "registrar", action: "registration.approved", entityType: "registration" },
      { id: randomUUID(), actorRole: "registrar", action: "certificate.generated", entityType: "certificate" },
      { id: randomUUID(), actorRole: "student", action: "request.submitted", entityType: "document_request" },
    ];
    const seeded = seedRows.map((row) => ({ ...row, entityId: `LOGFALLBACK-${row.id}`, recordHash: recordHash(row.id) }));

    try {
      await db.insert(auditLogs).values(seeded);
      const views = await listLocalAuditTrailViews({ all: true });
      const listedIds = new Set(views.map((view) => view.referenceId));

      assert.ok(listedIds.has(seeded[3].entityId), "certificate action must be listed");
      assert.ok(listedIds.has(seeded[4].entityId), "document_request action must be listed");
      assert.ok(!listedIds.has(seeded[0].entityId), "user.create must not be listed");
      assert.ok(!listedIds.has(seeded[1].entityId), "update_settings must not be listed");
      assert.ok(!listedIds.has(seeded[2].entityId), "registration decision must not be listed");
    } finally {
      await db.delete(auditLogs).where(inArray(auditLogs.id, seeded.map((row) => row.id)));
    }
  });
});
