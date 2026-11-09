import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { documentTypes } = await import("@/db/schema");
const { createDocumentType, deactivateDocumentType, updateDocumentType } = await import("@/lib/services/document-types");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

function input(name = "Test Transcript") {
  fixtureIndex += 1;
  return {
    name: `${name} ${Date.now()}-${fixtureIndex}`,
    code: `TEST_${Date.now()}_${fixtureIndex}`,
    description: "Test document type",
    requirements: ["Valid ID"],
    processingDays: 4,
    fee: 0,
    isActive: true,
  };
}

describe("document type CRUD (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("create adds a document type", async () => {
    const values = input();
    let id = "";
    try {
      const created = await createDocumentType(values);
      id = created.id;
      assert.equal(created.name, values.name);
      assert.equal(created.code, values.code);
      assert.equal(created.processingDays, values.processingDays);
      assert.equal(created.status, "Active");
    } finally {
      if (id) await getDb().delete(documentTypes).where(eq(documentTypes.id, id));
    }
  });

  it("update edits name and processing days", async () => {
    const initial = input("Update Transcript");
    const created = await createDocumentType(initial);
    const updatedInput = { ...initial, name: `${initial.name} Revised`, code: `${initial.code}_REV`, processingDays: 9 };
    try {
      const updated = await updateDocumentType(created.id, updatedInput);
      assert.equal(updated.name, updatedInput.name);
      assert.equal(updated.code, updatedInput.code);
      assert.equal(updated.processingDays, 9);
    } finally {
      await getDb().delete(documentTypes).where(eq(documentTypes.id, created.id));
    }
  });

  it("deactivate sets isActive false and keeps the row", async () => {
    const created = await createDocumentType(input("Deactivate Transcript"));
    try {
      await deactivateDocumentType(created.id);
      const row = await getDb().query.documentTypes.findFirst({ where: eq(documentTypes.id, created.id) });
      assert.ok(row);
      assert.equal(row.isActive, false);
    } finally {
      await getDb().delete(documentTypes).where(eq(documentTypes.id, created.id));
    }
  });
});
