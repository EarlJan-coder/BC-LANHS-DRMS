/**
 * One-off reset: wipe every account (admin, registrar, student), every generated
 * document/certificate, and every generated log from the target database.
 *
 * Kept: document types, signatory template, template wording (portal config).
 * Kept: the drizzle migration journal (schema stays current).
 *
 * Delete order is FK-safe: every foreign key is ON DELETE NO ACTION, so
 * children are removed before their parents inside a single transaction.
 *
 * Run: npx tsx scripts/wipe-portal-data.ts
 * Requires DATABASE_URL. Types "WIPE ALL DATA" before anything is deleted.
 */
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { sql } from "drizzle-orm";
import {
  auditLogs,
  authRateLimits,
  blockchainAuditLogs,
  certificates,
  documentRequests,
  notifications,
  requestStatusHistory,
  students,
  users,
} from "../src/db/schema";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

function ask(question: string) {
  const terminal = createInterface({ input: stdin, output: stdout });
  return terminal.question(question).finally(() => terminal.close());
}

type Db = Awaited<ReturnType<typeof import("../src/db").getDb>>;

/** FK-safe wipe order: children before parents. */
const TABLE_NAMES = [
  "blockchain_audit_logs",
  "audit_logs",
  "request_status_history",
  "notifications",
  "certificates",
  "document_requests",
  "students",
  "users",
  "auth_rate_limits",
] as const;

async function countRows(db: Db, tableName: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM ${sql.identifier(tableName)}`,
  );
  return Number(row?.n ?? 0);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const databaseHost = new URL(databaseUrl).hostname;
  console.log(`Target database host: ${databaseHost}`);
  console.log("This permanently deletes:");
  console.log("  - ALL accounts (admin, registrar, student) and student profiles");
  console.log("  - ALL generated documents, requests, and certificates");
  console.log("  - ALL notifications and audit logs (including blockchain audit logs)");
  console.log("Kept: document types, signatory template, template wording.");
  console.log("Create a fresh administrator afterwards with: npm run auth:bootstrap-admin");

  if ((await ask('Type "WIPE ALL DATA" to continue: ')).trim() !== "WIPE ALL DATA") {
    throw new Error("Wipe cancelled.");
  }

  const { closeDb, getDb } = await import("../src/db");
  const db = getDb();

  try {
    console.log("\nRow counts before wipe:");
    const before = new Map<string, number>();
    for (const name of TABLE_NAMES) {
      const n = await countRows(db, name);
      before.set(name, n);
      console.log(`  ${name}: ${n}`);
    }

    const total = [...before.values()].reduce((sum, n) => sum + n, 0);
    if (total === 0) {
      console.log("\nNothing to delete.");
      return;
    }

    // Children before parents: every FK is ON DELETE NO ACTION, so deleting
    // out of order fails mid-transaction (and the transaction rolls back).
    await db.transaction(async (tx) => {
      await tx.delete(blockchainAuditLogs);
      await tx.delete(auditLogs);
      await tx.delete(requestStatusHistory);
      await tx.delete(notifications);
      await tx.delete(certificates);
      await tx.delete(documentRequests);
      await tx.delete(students);
      await tx.delete(users);
      await tx.delete(authRateLimits);
    });

    console.log("\nRow counts after wipe:");
    let remaining = 0;
    for (const name of TABLE_NAMES) {
      const n = await countRows(db, name);
      remaining += n;
      console.log(`  ${name}: ${n}`);
    }

    if (remaining !== 0) {
      throw new Error(`Wipe incomplete: ${remaining} rows remain across wiped tables.`);
    }

    console.log(`\nWipe complete. ${total} rows deleted.`);
    console.log("Next: run npm run auth:bootstrap-admin to create the fresh administrator.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Wipe failed.");
  process.exitCode = 1;
});
