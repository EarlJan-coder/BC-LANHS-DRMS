import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";
// Never talk to a real chain from tests: the blockchain client reads the zero
// address as "not configured" and answers without any network call.
process.env.CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const { eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { auditLogs, blockchainAuditLogs } = await import("@/db/schema");
const { isOnChainReferenceType, recordAuditedAction } = await import("@/lib/services/audit-log");

const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  await closeDb();
});

let fixtureSeq = 0;

function fixtureReference() {
  fixtureSeq += 1;
  return `audit-log-fixture-${Date.now()}-${fixtureSeq}`;
}

// Chain rows are removed before the audit rows they point at (FK), and cleanup
// failures must not fail a run — same hardening as notifications.test.ts.
async function deleteFixtures(references: string[]) {
  const db = getDb();
  await db.delete(blockchainAuditLogs).where(inArray(blockchainAuditLogs.referenceId, references));
  await db.delete(auditLogs).where(inArray(auditLogs.entityId, references));
}

describe("isOnChainReferenceType", () => {
  it("allows document records and nothing else", () => {
    assert.equal(isOnChainReferenceType("certificate"), true);
    assert.equal(isOnChainReferenceType("document_request"), true);
    assert.equal(isOnChainReferenceType("status_change"), true);
    assert.equal(isOnChainReferenceType("user"), false);
    assert.equal(isOnChainReferenceType("registration"), false);
    assert.equal(isOnChainReferenceType("system"), false);
  });
});

describe("recordAuditedAction (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("submits document records to the chain log", async () => {
    const reference = fixtureReference();
    try {
      const result = await recordAuditedAction({
        referenceType: "document_request",
        referenceId: reference,
        action: "Document request submitted",
        actorRole: "student",
        entityType: "document_request",
        entityId: reference,
        hashMetadata: {
          trackingNumber: reference,
          documentType: "Form 137",
          status: "pending",
          schoolYearNeeded: null,
          gradeLevelNeeded: null,
          strandNeeded: null,
        },
      });

      assert.equal(typeof result.recordHash, "string");
      // The chain client is stubbed out above, so the row stays pending.
      assert.equal(result.blockchainStatus, "blockchain_pending");

      const db = getDb();
      const rows = await db
        .select()
        .from(blockchainAuditLogs)
        .where(eq(blockchainAuditLogs.referenceId, reference));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].referenceType, "document_request");
      assert.equal(rows[0].blockchainStatus, "pending");
    } finally {
      await deleteFixtures([reference]);
    }
  });

  it("keeps account actions in the local audit log only", async () => {
    const reference = fixtureReference();
    try {
      const result = await recordAuditedAction({
        referenceType: "user",
        referenceId: reference,
        action: "user.create",
        actorRole: "admin",
        entityType: "user",
        entityId: reference,
      });

      assert.equal(typeof result.recordHash, "string");
      assert.equal(result.blockchainStatus, null);
      assert.equal(result.blockchainTransactionHash, null);
      assert.equal(result.blockNumber, null);

      const db = getDb();
      const chainRows = await db
        .select()
        .from(blockchainAuditLogs)
        .where(eq(blockchainAuditLogs.referenceId, reference));
      assert.equal(chainRows.length, 0);

      const auditRows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, reference));
      assert.equal(auditRows.length, 1);
      assert.equal(auditRows[0].action, "user.create");
    } finally {
      await deleteFixtures([reference]);
    }
  });

  it("keeps registration decisions in the local audit log only", async () => {
    const reference = fixtureReference();
    try {
      const result = await recordAuditedAction({
        referenceType: "registration",
        referenceId: reference,
        action: "Registration approved",
        actorRole: "registrar",
        entityType: "registration",
        entityId: reference,
      });

      assert.equal(result.blockchainStatus, null);

      const db = getDb();
      const chainRows = await db
        .select()
        .from(blockchainAuditLogs)
        .where(eq(blockchainAuditLogs.referenceId, reference));
      assert.equal(chainRows.length, 0);

      const auditRows = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, reference));
      assert.equal(auditRows.length, 1);
    } finally {
      await deleteFixtures([reference]);
    }
  });
});
