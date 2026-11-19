import { describe, it, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { and, eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { systemSettings: systemSettingsTable, auditLogs, users } = await import("@/db/schema");
const {
  DEFAULT_SYSTEM_SETTINGS,
  SETTINGS_KEYS,
  parseSystemSettings,
  getSystemSettings,
  saveSystemSettings,
} = await import("@/lib/services/system-settings");

const hasDb = Boolean(process.env.DATABASE_URL);

type SettingsRow = typeof systemSettingsTable.$inferSelect;
let savedRows: SettingsRow[] = [];

async function snapshotRows() {
  savedRows = await getDb().select().from(systemSettingsTable);
}

async function restoreRows() {
  const db = getDb();
  await db.delete(systemSettingsTable);
  if (savedRows.length) await db.insert(systemSettingsTable).values(savedRows);
}

afterEach(async () => {
  if (hasDb) {
    try {
      await restoreRows();
      // Saves in earlier tests leave audit rows behind; remove them so each
      // test starts clean (cleanup must never fail a run — same hardening as
      // audit-log.test.ts).
      await getDb().delete(auditLogs).where(eq(auditLogs.entityType, "system_settings"));
    } catch {
      // Cleanup must never fail a run (same hardening as audit-log.test.ts).
    }
  }
});

after(async () => {
  await closeDb();
});

describe("DEFAULT_SYSTEM_SETTINGS", () => {
  it("covers every settings key with plain values", () => {
    assert.deepEqual(Object.keys(DEFAULT_SYSTEM_SETTINGS).sort(), [...SETTINGS_KEYS].sort());
    assert.equal(DEFAULT_SYSTEM_SETTINGS.signupOpen, true);
    assert.equal(DEFAULT_SYSTEM_SETTINGS.autoFixProofs, true);
    assert.equal(DEFAULT_SYSTEM_SETTINGS.emailFromName.length > 0, true);
    assert.equal(DEFAULT_SYSTEM_SETTINGS.emailFromAddress.includes("@"), true);
  });
});

describe("parseSystemSettings", () => {
  it("accepts a full valid payload", () => {
    const parsed = parseSystemSettings({
      signupOpen: false,
      emailFromName: "Registrar Office",
      emailFromAddress: "registrar@example.org",
      autoFixProofs: false,
    });
    assert.deepEqual(parsed, {
      signupOpen: false,
      emailFromName: "Registrar Office",
      emailFromAddress: "registrar@example.org",
      autoFixProofs: false,
    });
  });

  it("rejects an invalid sender email address with a plain message", () => {
    assert.throws(
      () =>
        parseSystemSettings({
          ...DEFAULT_SYSTEM_SETTINGS,
          emailFromAddress: "not-an-email",
        }),
      (error: Error & { issues?: Array<{ message: string }> }) =>
        error.name === "ZodError" &&
        Boolean(error.issues?.[0]?.message.includes("valid email")),
    );
  });

  it("rejects an empty sender name with a plain message", () => {
    assert.throws(
      () => parseSystemSettings({ ...DEFAULT_SYSTEM_SETTINGS, emailFromName: "   " }),
      (error: Error & { issues?: Array<{ message: string }> }) =>
        error.name === "ZodError" &&
        Boolean(error.issues?.[0]?.message.includes("sender name")),
    );
  });

  it("rejects a missing key", () => {
    const incomplete: Record<string, unknown> = { ...DEFAULT_SYSTEM_SETTINGS };
    delete incomplete.signupOpen;
    assert.throws(() => parseSystemSettings(incomplete), (error: Error) => error.name === "ZodError");
  });
});

describe("environment sender fallback (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL is not configured",
}, () => {
  it("derives the default sender from RESEND_FROM_EMAIL when nothing is saved", async () => {
    await snapshotRows();
    await getDb().delete(systemSettingsTable);
    const previous = process.env.RESEND_FROM_EMAIL;
    process.env.RESEND_FROM_EMAIL = "Custom Desk <custom@example.org>";

    try {
      const settings = await getSystemSettings();
      assert.equal(settings.emailFromName, "Custom Desk");
      assert.equal(settings.emailFromAddress, "custom@example.org");
    } finally {
      if (previous === undefined) delete process.env.RESEND_FROM_EMAIL;
      else process.env.RESEND_FROM_EMAIL = previous;
    }
  });
});

describe("getSystemSettings / saveSystemSettings (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL is not configured",
}, () => {
  it("returns defaults when no rows are stored", async () => {
    await snapshotRows();
    await getDb().delete(systemSettingsTable);

    assert.deepEqual(await getSystemSettings(), DEFAULT_SYSTEM_SETTINGS);
  });

  it("saves and reads back values, ignoring corrupt rows", async () => {
    await snapshotRows();
    const saved = await saveSystemSettings({
      signupOpen: false,
      emailFromName: "Registrar Office",
      emailFromAddress: "registrar@example.org",
      autoFixProofs: false,
    });
    assert.deepEqual(saved, {
      signupOpen: false,
      emailFromName: "Registrar Office",
      emailFromAddress: "registrar@example.org",
      autoFixProofs: false,
    });

    // A corrupt row must not take the page down: it falls back to the default.
    await getDb()
      .insert(systemSettingsTable)
      .values({ key: "autoFixProofs", value: "not-a-boolean" })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: "not-a-boolean" } });

    const read = await getSystemSettings();
    assert.equal(read.signupOpen, false);
    assert.equal(read.autoFixProofs, DEFAULT_SYSTEM_SETTINGS.autoFixProofs);
  });

  it("records an audit entry naming the changed settings", async () => {
    await snapshotRows();
    await getDb().delete(systemSettingsTable);

    const db = getDb();
    const [actor] = await db
      .insert(users)
      .values({
        email: `settings-fixture-${Date.now()}@example.test`,
        passwordHash: "test-hash",
        firstName: "Settings",
        lastName: "Fixture",
        role: "admin",
      })
      .returning();

    try {
      await saveSystemSettings({ ...DEFAULT_SYSTEM_SETTINGS, signupOpen: false }, actor.id);

      const [entry] = await db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityType, "system_settings"), eq(auditLogs.action, "update_settings")));

      assert.ok(entry, "expected an audit log entry for the settings update");
      assert.equal(entry.actorUserId, actor.id);
      assert.deepEqual(entry.metadata, { changed: ["signupOpen"] });
    } finally {
      await db.delete(auditLogs).where(eq(auditLogs.entityId, "system_settings"));
      await db.delete(users).where(eq(users.id, actor.id));
    }
  });
});
