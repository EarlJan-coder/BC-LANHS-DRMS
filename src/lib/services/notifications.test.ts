import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { notifications, users } = await import("@/db/schema");
const { countUnread, fanOutNewRequestNotification, listUserNotifications, markAll, markRead } = await import(
  "@/lib/services/notifications"
);

const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  await closeDb();
});

let fixtureSeq = 0;

function fixtureEmail() {
  fixtureSeq += 1;
  return `notif-fixture-${Date.now()}-${fixtureSeq}@example.test`;
}

async function createFixtureUser(overrides: {
  role?: "student" | "alumni" | "registrar" | "admin";
  isActive?: boolean;
  status?: "active" | "inactive" | "suspended";
} = {}) {
  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({
      email: fixtureEmail(),
      passwordHash: "test-hash",
      firstName: "Notif",
      lastName: "Fixture",
      role: overrides.role ?? "registrar",
      isActive: overrides.isActive ?? true,
      status: overrides.status ?? "active",
    })
    .returning();
  return row;
}

async function createFixtureNotification(
  userId: string,
  overrides: { isRead?: boolean; title?: string; message?: string } = {},
) {
  const db = getDb();
  const [row] = await db
    .insert(notifications)
    .values({
      userId,
      type: "request",
      title: overrides.title ?? "Fixture notification",
      message: overrides.message ?? "Fixture message",
      isRead: overrides.isRead ?? false,
    })
    .returning();
  return row;
}

async function deleteFixtureUsers(ids: string[]) {
  const db = getDb();
  await db.delete(notifications).where(inArray(notifications.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

describe("countUnread (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("counts only unread rows for the given user", async () => {
    const owner = await createFixtureUser();
    const other = await createFixtureUser();

    try {
      await createFixtureNotification(owner.id);
      await createFixtureNotification(owner.id);
      await createFixtureNotification(owner.id, { isRead: true });
      await createFixtureNotification(other.id);

      assert.equal(await countUnread(owner.id), 2);
      assert.equal(await countUnread(other.id), 1);
    } finally {
      await deleteFixtureUsers([owner.id, other.id]);
    }
  });
});

describe("markRead (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("marks the owner's notification read and is idempotent on a read row", async () => {
    const owner = await createFixtureUser();
    const db = getDb();

    try {
      const row = await createFixtureNotification(owner.id);

      await markRead(owner.id, row.id);
      let stored = await db.select().from(notifications).where(inArray(notifications.id, [row.id]));
      assert.equal(stored[0].isRead, true);
      assert.equal(await countUnread(owner.id), 0);

      // Marking an already-read notification again succeeds (idempotent).
      await markRead(owner.id, row.id);
      stored = await db.select().from(notifications).where(inArray(notifications.id, [row.id]));
      assert.equal(stored[0].isRead, true);
    } finally {
      await deleteFixtureUsers([owner.id]);
    }
  });

  it("maps a non-owner's notification to a 404-mapped error and leaves the row unread", async () => {
    const owner = await createFixtureUser();
    const other = await createFixtureUser();
    const db = getDb();

    try {
      const row = await createFixtureNotification(owner.id);

      await assert.rejects(
        () => markRead(other.id, row.id),
        (error: Error & { status?: number }) => {
          assert.match(error.message, /not found/i);
          assert.equal(error.status, 404);
          return true;
        },
      );

      const stored = await db.select().from(notifications).where(inArray(notifications.id, [row.id]));
      assert.equal(stored[0].isRead, false);
    } finally {
      await deleteFixtureUsers([owner.id, other.id]);
    }
  });

  it("maps unknown and malformed ids to the same not-found error", async () => {
    const owner = await createFixtureUser();

    try {
      await assert.rejects(() => markRead(owner.id, "11111111-1111-1111-1111-111111111111"), /not found/i);
      await assert.rejects(() => markRead(owner.id, "not-a-uuid"), /not found/i);
    } finally {
      await deleteFixtureUsers([owner.id]);
    }
  });
});

describe("markAll (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("marks every unread row read once and reports how many changed", async () => {
    const owner = await createFixtureUser();
    const other = await createFixtureUser();

    try {
      await createFixtureNotification(owner.id);
      await createFixtureNotification(owner.id);
      await createFixtureNotification(owner.id);
      await createFixtureNotification(owner.id, { isRead: true });
      await createFixtureNotification(other.id);

      assert.equal(await markAll(owner.id), 3);
      assert.equal(await countUnread(owner.id), 0);
      assert.equal(await markAll(owner.id), 0);
      // Another user's notifications are untouched.
      assert.equal(await countUnread(other.id), 1);
    } finally {
      await deleteFixtureUsers([owner.id, other.id]);
    }
  });
});

describe("fanOutNewRequestNotification (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("inserts one 'request' notification per ACTIVE registrar and nobody else", async () => {
    const db = getDb();
    const activeA = await createFixtureUser({ role: "registrar", isActive: true, status: "active" });
    const activeB = await createFixtureUser({ role: "registrar", isActive: true, status: "active" });
    const inactiveFlag = await createFixtureUser({ role: "registrar", isActive: false, status: "active" });
    const suspended = await createFixtureUser({ role: "registrar", isActive: true, status: "suspended" });
    const admin = await createFixtureUser({ role: "admin", isActive: true, status: "active" });
    const student = await createFixtureUser({ role: "student", isActive: true, status: "active" });
    const everyone = [activeA.id, activeB.id, inactiveFlag.id, suspended.id, admin.id, student.id];
    const fixtureIds = new Set(everyone);
    // Every row this fan-out creates — including copies landing on REAL active
    // registrars on a shared DB — is cleaned up in `finally`.
    let createdIds: string[] = [];

    try {
      const created = await fanOutNewRequestNotification("LANHS-TEST-0001", "Form 137");
      createdIds = created.map((row) => row.id);

      const recipientIds = created.map((row) => row.userId).filter((id): id is string => id !== null);

      // Exactly one row per recipient, and every recipient (fixture or real)
      // is an ACTIVE registrar — the ruled target set.
      assert.equal(new Set(recipientIds).size, created.length);
      assert.ok(recipientIds.length > 0);
      const recipients = await db
        .select({ id: users.id, role: users.role, isActive: users.isActive, status: users.status })
        .from(users)
        .where(inArray(users.id, recipientIds));
      assert.equal(recipients.length, recipientIds.length);
      assert.ok(recipients.every((row) => row.role === "registrar" && row.isActive && row.status === "active"));

      // Fixture-scoped target assertion: a shared DB may hold real active
      // registrars who also receive copies, so the absolute inserted set is
      // only asserted over the fixture ids.
      assert.deepEqual(
        recipientIds.filter((id) => fixtureIds.has(id)).sort(),
        [activeA.id, activeB.id].sort(),
      );

      // Fixture-scoped negatives: inactive/suspended registrars, admins, and
      // students receive nothing.
      const rows = await db
        .select()
        .from(notifications)
        .where(inArray(notifications.userId, everyone));

      assert.deepEqual(
        rows.map((row) => row.userId).sort(),
        [activeA.id, activeB.id].sort(),
      );
      assert.ok(rows.every((row) => row.type === "request"));
      assert.ok(rows.every((row) => row.title === "New document request submitted"));
      assert.ok(rows.every((row) => row.message === "LANHS-TEST-0001 (Form 137) is awaiting registrar review."));
    } finally {
      // Delete every row the fan-out created — including copies that landed on
      // REAL registrars — so a shared DB is left exactly as it was found.
      if (createdIds.length > 0) {
        await db.delete(notifications).where(inArray(notifications.id, createdIds));
      }
      await deleteFixtureUsers(everyone);
    }
  });
});

describe("listUserNotifications (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("lists only the given user's rows, newest first", async () => {
    const owner = await createFixtureUser();
    const other = await createFixtureUser();

    try {
      const first = await createFixtureNotification(owner.id, { title: "First" });
      await createFixtureNotification(owner.id, { title: "Second" });
      await createFixtureNotification(other.id, { title: "Other user" });

      const rows = await listUserNotifications(owner.id);

      assert.equal(rows.length, 2);
      assert.deepEqual(rows.map((row) => row.title), ["Second", "First"]);
      assert.ok(rows.every((row) => row.id !== undefined));
      assert.ok(rows.every((row) => typeof row.isRead === "boolean"));
      assert.ok(rows.every((row) => row.createdAt instanceof Date));
      assert.equal(first.title, "First");
    } finally {
      await deleteFixtureUsers([owner.id, other.id]);
    }
  });
});
