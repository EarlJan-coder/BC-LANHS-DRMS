import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { and, desc, eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { systemSettings: systemSettingsTable, auditLogs, users } = await import("@/db/schema");
const { apiGuardEffects } = await import("@/lib/api-guards");
const { DEFAULT_SYSTEM_SETTINGS } = await import("@/lib/services/system-settings");
const { GET, PUT } = await import("@/app/api/settings/route");
const { isProtectedPath } = await import("@/proxy");

type CurrentUser = NonNullable<Awaited<ReturnType<typeof apiGuardEffects.resolveUser>>>;

const hasDb = Boolean(process.env.DATABASE_URL);

type SettingsRow = typeof systemSettingsTable.$inferSelect;
let savedRows: SettingsRow[] = [];
let fixtureUserId: string | undefined;

function mockUser(user: CurrentUser | null) {
  mock.method(apiGuardEffects, "resolveUser", async () => user);
}

function userWithRole(role: "admin" | "registrar" | "student", id = `route-test-${role}`): CurrentUser {
  return { id, role } as unknown as CurrentUser;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    signupOpen: false,
    emailFromName: "Registrar Office",
    emailFromAddress: "registrar@example.org",
    ...overrides,
  };
}

async function callPut(body: unknown) {
  return PUT(
    new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

before(async () => {
  if (!hasDb) return;
  const [actor] = await getDb()
    .insert(users)
    .values({
      email: `settings-route-fixture-${Date.now()}@example.test`,
      passwordHash: "test-hash",
      firstName: "Settings",
      lastName: "Fixture",
      role: "admin",
    })
    .returning();
  fixtureUserId = actor.id;
});

afterEach(async () => {
  mock.restoreAll();
  if (hasDb) {
    try {
      const db = getDb();
      await db.delete(systemSettingsTable);
      if (savedRows.length) await db.insert(systemSettingsTable).values(savedRows);
      await db.delete(auditLogs).where(eq(auditLogs.entityType, "system_settings"));
    } catch {
      // Cleanup must never fail a run (same hardening as audit-log.test.ts).
    }
  }
});

after(async () => {
  if (hasDb && fixtureUserId) {
    try {
      await getDb().delete(users).where(eq(users.id, fixtureUserId));
    } catch {
      // Cleanup must never fail a run.
    }
  }
  await closeDb();
});

describe("settings route auth", () => {
  it("rejects an unauthenticated GET with 401", async () => {
    const response = await GET();
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Please sign in to continue." });
  });

  for (const role of ["registrar", "student"] as const) {
    it(`rejects ${role} access on every method with 403`, async () => {
      mockUser(userWithRole(role));
      for (const call of [() => GET(), () => callPut(validPayload())]) {
        const response = await call();
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { error: "You do not have access to this resource." });
      }
    });
  }
});

describe("settings route (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL is not configured",
}, () => {
  it("GET returns the stored settings with defaults merged", async () => {
    savedRows = await getDb().select().from(systemSettingsTable);
    await getDb().delete(systemSettingsTable);
    mockUser(userWithRole("admin", fixtureUserId));

    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, DEFAULT_SYSTEM_SETTINGS);
  });

  it("PUT saves settings and returns them, recording the acting admin", async () => {
    savedRows = await getDb().select().from(systemSettingsTable);
    await getDb().delete(systemSettingsTable);
    mockUser(userWithRole("admin", fixtureUserId));

    const response = await callPut(validPayload());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, validPayload());

    const rows = await getDb().select().from(systemSettingsTable);
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    assert.deepEqual(stored, validPayload());
    assert.ok(rows.every((row) => row.updatedBy === fixtureUserId));

    // Scope to this test's write: audit_logs on the shared database holds rows
    // from real usage (password resets and friends), so an unscoped select
    // returns an arbitrary row.
    const [entry] = await getDb()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, "system_settings"), eq(auditLogs.actorUserId, fixtureUserId!)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    assert.ok(entry, "expected an audit entry for the settings save");
    assert.equal(entry.action, "update_settings");
    assert.equal(entry.actorUserId, fixtureUserId);
  });

  it("rejects an invalid sender email with a plain 400 message", async () => {
    mockUser(userWithRole("admin", fixtureUserId));

    const response = await callPut(validPayload({ emailFromAddress: "not-an-email" }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, { error: "Enter a valid email address for outgoing emails." });
  });

  it("rejects malformed JSON with a 400", async () => {
    mockUser(userWithRole("admin", fixtureUserId));

    const response = await callPut("{not json");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid request body." });
  });
});

describe("settings route proxy protection", () => {
  it("is covered by the session proxy", () => {
    assert.equal(isProtectedPath("/api/settings"), true);
  });
});
