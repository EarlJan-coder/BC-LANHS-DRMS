import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { documentRequests } = await import("@/db/schema");
const { getDocumentRequestView, listDocumentRequestViews } = await import("@/lib/services/live-data");

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
});
