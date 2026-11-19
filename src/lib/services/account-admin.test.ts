import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AppError } from "@/lib/utils";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { students, users } = await import("@/db/schema");
const { comparePassword } = await import("@/lib/password");
const { userCreateSchema, passwordChangeSchema } = await import("@/lib/validators");
const { createPortalAccount, assertAdmin, resetUserPassword, changeOwnPassword } = await import("@/lib/services/account-admin");

const hasDb = Boolean(process.env.DATABASE_URL);
// Run-unique fixture tag: a crashed run can leak fixture rows, and fixed
// emails would then deterministically block every later run (see sibling
// test files for the same convention).
const RUN_TAG = Date.now().toString(36).slice(-5);
function fixtureEmail(local: string) {
  return `${local}-${RUN_TAG}@example.com`;
}

after(async () => {
  await closeDb();
});

async function deleteUsers(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await db.delete(students).where(inArray(students.userId, ids));
      await db.delete(users).where(inArray(users.id, ids));
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
  // Cleanup is not the behavior under test, and fixture emails are run-unique,
  // so a transient remote-DB failure here must neither fail the test run nor
  // poison later runs. (Observed: Neon blips during cleanup failed whole runs.)
  console.warn(`account-admin.test.ts: fixture cleanup failed for ${ids.join(", ")}:`, lastError);
}

describe("createPortalAccount (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  test("createPortalAccount approves registrar accounts, generates a temporary password, and leaves the LRN empty", async () => {
    const created = await createPortalAccount({
      email: fixtureEmail("reg"),
      firstName: "Rina",
      lastName: "Reyes",
      role: "registrar",
    });

    try {
      assert.match(created.temporaryPassword, /^[A-Z0-9]{12}$/);
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.equal(row?.mustChangePassword, true);
      assert.equal(row?.lrn, null);
      assert.equal(row?.role, "registrar");
      assert.equal(row?.registrationStatus, "approved");
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("createPortalAccount creates a linked student record for student accounts", async () => {
    const created = await createPortalAccount({
      email: fixtureEmail("stu"),
      firstName: "Sasha",
      lastName: "Santos",
      role: "student",
      lrn: "123456789012",
    });

    try {
      const userRow = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.equal(userRow?.role, "student");
      assert.equal(userRow?.lrn, "123456789012");
      assert.equal(userRow?.registrationStatus, "approved");

      const studentRow = await getDb().query.students.findFirst({ where: eq(students.userId, created.id) });
      assert.ok(studentRow, "expected a linked student record");
      assert.equal(studentRow.lrn, "123456789012");
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("createPortalAccount rejects a duplicate email with a 409", async () => {
    const created = await createPortalAccount({
      email: fixtureEmail("dup"),
      firstName: "A",
      lastName: "B",
      role: "registrar",
    });

    try {
      await assert.rejects(
        () =>
          createPortalAccount({
            email: fixtureEmail("dup"),
            firstName: "C",
            lastName: "D",
            role: "registrar",
          }),
        (error: AppError) => error.status === 409,
      );
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("createPortalAccount hashes the generated password and never stores it", async () => {
    const created = await createPortalAccount({
      email: fixtureEmail("hash"),
      firstName: "H",
      lastName: "I",
      role: "registrar",
    });

    try {
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.notEqual(row?.passwordHash, created.temporaryPassword);
      assert.ok(row?.passwordHash.startsWith("$2"));
      assert.ok(await comparePassword(created.temporaryPassword, row?.passwordHash ?? ""));
    } finally {
      await deleteUsers([created.id]);
    }
  });
});

describe("resetUserPassword (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  test("resetUserPassword generates a new password, replaces the hash, and re-arms mustChangePassword", async () => {
    const created = await createPortalAccount({ email: fixtureEmail("reset"), firstName: "R", lastName: "S", role: "registrar" });

    try {
      await getDb().update(users).set({ mustChangePassword: false }).where(eq(users.id, created.id));
      const { temporaryPassword } = await resetUserPassword(created.id);
      assert.match(temporaryPassword, /^[A-Z0-9]{12}$/);
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.equal(row?.mustChangePassword, true);
      assert.ok(await comparePassword(temporaryPassword, row?.passwordHash ?? ""));
      assert.ok(!(await comparePassword(created.temporaryPassword, row?.passwordHash ?? "")));
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("resetUserPassword bumps tokenVersion so outstanding cookies are revoked", async () => {
    const created = await createPortalAccount({ email: fixtureEmail("rev"), firstName: "R", lastName: "V", role: "registrar" });

    try {
      const before = (await getDb().query.users.findFirst({ where: eq(users.id, created.id) }))?.tokenVersion;
      await resetUserPassword(created.id);
      const after = (await getDb().query.users.findFirst({ where: eq(users.id, created.id) }))?.tokenVersion;
      assert.equal(after, (before ?? 0) + 1);
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("resetUserPassword throws 404 for an unknown user", async () => {
    await assert.rejects(() => resetUserPassword("00000000-0000-4000-8000-000000000000"), (e: AppError) => e.status === 404);
  });

  test("resetUserPassword refuses to touch the administrator account", async () => {
    const [admin] = await getDb()
      .insert(users)
      .values({
        email: fixtureEmail("admin-guard"),
        firstName: "A",
        lastName: "B",
        passwordHash: "$2a$12$placeholderplaceholderplaceholderplaceholderplaceholder",
        role: "admin",
      })
      .returning({ id: users.id });

    try {
      await assert.rejects(() => resetUserPassword(admin.id), (e: AppError) => e.status === 403);
    } finally {
      await deleteUsers([admin.id]);
    }
  });
});

describe("changeOwnPassword (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  test("changeOwnPassword rejects a wrong current password with 401", async () => {
    const created = await createPortalAccount({ email: fixtureEmail("self"), firstName: "S", lastName: "E", role: "registrar" });
    try {
      await assert.rejects(() => changeOwnPassword(created.id, "not-the-password", "brandnew12345"), (e: AppError) => e.status === 401);
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.ok(row);
      assert.ok(await comparePassword(created.temporaryPassword, row.passwordHash));
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("changeOwnPassword clears mustChangePassword and returns the bumped tokenVersion", async () => {
    const created = await createPortalAccount({ email: fixtureEmail("done"), firstName: "D", lastName: "O", role: "registrar" });
    try {
      const result = await changeOwnPassword(created.id, created.temporaryPassword, "brandnew12345");
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.ok(row);
      assert.equal(row.mustChangePassword, false);
      assert.equal(result.tokenVersion, row.tokenVersion);
      assert.ok(result.tokenVersion > 0);
    } finally {
      await deleteUsers([created.id]);
    }
  });

  test("changeOwnPassword rejects a short new password", () => {
    assert.throws(() => passwordChangeSchema.parse({ currentPassword: "placeholder123", newPassword: "short" }));
  });

  test("changeOwnPassword rejects when the new password matches the current one and leaves state unchanged", async () => {
    const created = await createPortalAccount({ email: fixtureEmail("same"), firstName: "S", lastName: "A", role: "registrar" });
    try {
      await assert.rejects(
        () => changeOwnPassword(created.id, created.temporaryPassword, created.temporaryPassword),
        (e: AppError) => e.status === 400 && e.message === "New password must be different from your current password.",
      );
      const row = await getDb().query.users.findFirst({ where: eq(users.id, created.id) });
      assert.ok(row);
      assert.ok(await comparePassword(created.temporaryPassword, row.passwordHash));
      assert.equal(row.mustChangePassword, true);
    } finally {
      await deleteUsers([created.id]);
    }
  });
});

test("userCreateSchema rejects the admin role at the schema boundary", () => {
  assert.throws(() =>
    userCreateSchema.parse({
      email: fixtureEmail("s"),
      firstName: "S",
      lastName: "T",
      role: "admin",
    }),
  );
});

test("userCreateSchema requires an LRN for student accounts", () => {
  assert.throws(() =>
    userCreateSchema.parse({
      email: fixtureEmail("no-lrn"),
      firstName: "S",
      lastName: "T",
      role: "student",
    }),
  );
  assert.doesNotThrow(() =>
    userCreateSchema.parse({
      email: fixtureEmail("with-lrn"),
      firstName: "S",
      lastName: "T",
      role: "student",
      lrn: "123456789012",
    }),
  );
});

test("createPortalAccount rejects the admin role at the service boundary", async () => {
  await assert.rejects(
    () =>
      createPortalAccount({
        email: fixtureEmail("svc-admin"),
        firstName: "S",
        lastName: "T",
        role: "admin",
      }),
    (e: AppError) => e.status === 400,
  );
});

test("assertAdmin allows an admin and throws 403 for every other role", () => {
  assert.doesNotThrow(() => assertAdmin({ role: "admin" }));
  for (const role of ["student", "registrar"] as const) {
    assert.throws(() => assertAdmin({ role }), (e: AppError) => e.status === 403);
  }
});
