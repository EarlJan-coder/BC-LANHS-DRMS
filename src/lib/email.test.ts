import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { getDb, closeDb } = await import("@/db");
const { systemSettings: systemSettingsTable } = await import("@/db/schema");
const { resolveEmailFrom } = await import("@/lib/email");

const hasDb = Boolean(process.env.DATABASE_URL);

type SettingsRow = typeof systemSettingsTable.$inferSelect;
let savedRows: SettingsRow[] = [];
let previousEnv: string | undefined;

afterEach(async () => {
  if (hasDb) {
    try {
      const db = getDb();
      await db.delete(systemSettingsTable);
      if (savedRows.length) await db.insert(systemSettingsTable).values(savedRows);
    } catch {
      // Cleanup must never fail a run (same hardening as audit-log.test.ts).
    }
  }
  if (previousEnv === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = previousEnv;
});

after(async () => {
  await closeDb();
});

describe("resolveEmailFrom (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL is not configured",
}, () => {
  it("uses the saved sender name and address", async () => {
    savedRows = await getDb().select().from(systemSettingsTable);
    const db = getDb();
    await db.delete(systemSettingsTable);
    await db.insert(systemSettingsTable).values([
      { key: "emailFromName", value: "Registrar Office" },
      { key: "emailFromAddress", value: "registrar@example.org" },
    ]);

    assert.equal(await resolveEmailFrom(), "Registrar Office <registrar@example.org>");
  });

  it("falls back to the configured default when nothing is saved", async () => {
    savedRows = await getDb().select().from(systemSettingsTable);
    await getDb().delete(systemSettingsTable);
    previousEnv = process.env.RESEND_FROM_EMAIL;
    process.env.RESEND_FROM_EMAIL = "Custom Desk <custom@example.org>";

    assert.equal(await resolveEmailFrom(), "Custom Desk <custom@example.org>");
  });
});
