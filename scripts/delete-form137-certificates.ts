/**
 * One-off cleanup: permanently delete every generated Form 137 certificate
 * plus its certificate-scoped logs (blockchain audit, audit, notifications).
 *
 * Why: Form 137 is a DepEd hardcopy record — the school never issues a
 * certificate for it (there is no template), so certificates minted before
 * that rule existed are removed outright. Document requests, status history,
 * and request-level audit logs are kept.
 *
 * Honest caveat: CERTIFICATE_ISSUED events already submitted on-chain cannot
 * be removed. Public verification stops resolving for them because the
 * certificate row — and its verification code — is gone.
 *
 * Delete order is FK-safe: every foreign key is ON DELETE NO ACTION, so
 * children are removed before their parents inside a single transaction.
 *
 * Run: npx tsx scripts/delete-form137-certificates.ts
 * Requires DATABASE_URL. Types "DELETE FORM 137 CERTIFICATES" before
 * anything is deleted.
 */
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { and, count, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  blockchainAuditLogs,
  certificates,
  documentRequests,
  documentTypes,
  notifications,
} from "../src/db/schema";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

function ask(question: string) {
  const terminal = createInterface({ input: stdin, output: stdout });
  return terminal.question(question).finally(() => terminal.close());
}

/** Same name matching the app uses (isForm137DocumentType in certificates.ts). */
function isForm137(value: string | null | undefined): boolean {
  return (value ?? "").toLowerCase().includes("form 137");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const databaseHost = new URL(databaseUrl).hostname;
  const { closeDb, getDb } = await import("../src/db");
  const db = getDb();

  try {
    const rows = await db
      .select({
        id: certificates.id,
        certificateNumber: certificates.certificateNumber,
        certificateType: certificates.certificateType,
        documentTypeName: documentTypes.name,
      })
      .from(certificates)
      .leftJoin(documentRequests, eq(certificates.requestId, documentRequests.id))
      .leftJoin(documentTypes, eq(documentRequests.documentTypeId, documentTypes.id));

    const targets = rows.filter((row) => isForm137(row.documentTypeName) || isForm137(row.certificateType));
    if (targets.length === 0) {
      console.log("No Form 137 certificates found. Nothing to delete.");
      return;
    }

    const ids = targets.map((target) => target.id);
    const numbers = targets.map((target) => target.certificateNumber);

    const chainFilter = and(
      eq(blockchainAuditLogs.referenceType, "certificate"),
      inArray(blockchainAuditLogs.referenceId, numbers),
    );
    const auditFilter = and(eq(auditLogs.entityType, "certificate"), inArray(auditLogs.entityId, ids));
    const notificationFilter = and(
      eq(notifications.referenceType, "certificate"),
      inArray(notifications.referenceId, ids),
    );

    const [chainCount] = await db.select({ value: count() }).from(blockchainAuditLogs).where(chainFilter);
    const [auditCount] = await db.select({ value: count() }).from(auditLogs).where(auditFilter);
    const [notificationCount] = await db.select({ value: count() }).from(notifications).where(notificationFilter);

    console.log(`Target database host: ${databaseHost}`);
    console.log(`Found ${targets.length} Form 137 certificate(s):`);
    for (const target of targets) {
      console.log(`  - ${target.certificateNumber} (type: ${target.certificateType})`);
    }
    console.log("This permanently deletes:");
    console.log(`  - ${targets.length} certificate row(s)`);
    console.log(`  - ${Number(chainCount?.value ?? 0)} blockchain audit log row(s)`);
    console.log(`  - ${Number(auditCount?.value ?? 0)} audit log row(s)`);
    console.log(`  - ${Number(notificationCount?.value ?? 0)} notification row(s)`);
    console.log("Kept: document requests, status history, request-level audit logs, and all other certificates.");
    console.log("Note: on-chain CERTIFICATE_ISSUED events cannot be removed; their public verification stops resolving.");

    if ((await ask('Type "DELETE FORM 137 CERTIFICATES" to continue: ')).trim() !== "DELETE FORM 137 CERTIFICATES") {
      throw new Error("Cleanup cancelled.");
    }

    // Children before parents: blockchain logs reference audit logs, and
    // nothing may be left pointing at a deleted certificate.
    await db.transaction(async (tx) => {
      await tx.delete(blockchainAuditLogs).where(chainFilter);
      await tx.delete(auditLogs).where(auditFilter);
      await tx.delete(notifications).where(notificationFilter);
      await tx.delete(certificates).where(inArray(certificates.id, ids));
    });

    const remaining = await db.select({ id: certificates.id }).from(certificates).where(inArray(certificates.id, ids));
    if (remaining.length > 0) {
      throw new Error(`Cleanup incomplete: ${remaining.length} certificate row(s) remain.`);
    }

    console.log(`\nDone. Deleted ${targets.length} Form 137 certificate(s) and their certificate-scoped logs.`);
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Cleanup failed.");
  process.exitCode = 1;
});
