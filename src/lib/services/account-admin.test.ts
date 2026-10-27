import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { users } = await import("@/db/schema");
const { AppError } = await import("@/lib/utils");
const { userCreateSchema } = await import("@/lib/validators");
const { createStaffAccount, assertAdmin } = await import("@/lib/services/account-admin");

const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  await closeDb();
});

async function deleteUsers(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  await db.delete(users).where(inArray(users.id, ids));
}

describe("createStaffAccount (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  test("createStaffAccount sets mustChangePassword and leaves the LRN empty", async () => {
    const created = await createStaffAccount({
      email: "reg@example.com",
      firstName: "Rina",
      lastName: "Reyes",
      role: "registrar",
      password: "placeholder123",
    });

    try {
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.equal(row?.mustChangePassword, true);
      assert.equal(row?.lrn, null);
      assert.equal(row?.role, "registrar");
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("createStaffAccount rejects a duplicate email with a 409", async () => {
    const created = await createStaffAccount({
      email: "dup@example.com",
      firstName: "A",
      lastName: "B",
      role: "admin",
      password: "placeholder123",
    });

    try {
      await assert.rejects(
        () =>
          createStaffAccount({
            email: "dup@example.com",
            firstName: "C",
            lastName: "D",
            role: "alumni",
            password: "placeholder123",
          }),
        (error: AppError) => error.status === 409,
      );
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("createStaffAccount hashes the password and never stores it", async () => {
    const created = await createStaffAccount({
      email: "hash@example.com",
      firstName: "H",
      lastName: "I",
      role: "alumni",
      password: "placeholder123",
    });

    try {
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.notEqual(row?.passwordHash, "placeholder123");
      assert.ok(row?.passwordHash.startsWith("$2"));
    } finally {
      await deleteUsers([created.id]);
    }
  });
});

test("createStaffAccount rejects the student role at the schema boundary", () => {
  assert.throws(() =>
    userCreateSchema.parse({
      email: "s@example.com",
      firstName: "S",
      lastName: "T",
      role: "student",
      password: "placeholder123",
    }),
  );
});

test("assertAdmin allows an admin and throws 403 for every other role", () => {
  assert.doesNotThrow(() => assertAdmin({ role: "admin" }));
  for (const role of ["student", "alumni", "registrar"] as const) {
    assert.throws(() => assertAdmin({ role }), (e: AppError) => e.status === 403);
  }
});
