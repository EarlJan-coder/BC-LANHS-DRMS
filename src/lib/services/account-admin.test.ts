import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { AppError } from "@/lib/utils";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { and, eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { auditLogs, certificates, documentRequests, notifications, requestStatusHistory, students, users } = await import("@/db/schema");
const { comparePassword } = await import("@/lib/password");
const { userCreateSchema, passwordChangeSchema } = await import("@/lib/validators");
const { createPortalAccount, assertAdmin, resetUserPassword, changeOwnPassword, deletePortalAccount } = await import("@/lib/services/account-admin");

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
      assert.equal(created.temporaryPassword.length, 12);
      assert.match(created.temporaryPassword, /[A-Z]/, "temporary password missing uppercase letter");
      assert.match(created.temporaryPassword, /[a-z]/, "temporary password missing lowercase letter");
      assert.match(created.temporaryPassword, /[0-9]/, "temporary password missing number");
      assert.match(created.temporaryPassword, /[^A-Za-z0-9]/, "temporary password missing symbol");
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
      assert.equal(temporaryPassword.length, 12);
      assert.match(temporaryPassword, /[A-Z]/, "temporary password missing uppercase letter");
      assert.match(temporaryPassword, /[a-z]/, "temporary password missing lowercase letter");
      assert.match(temporaryPassword, /[0-9]/, "temporary password missing number");
      assert.match(temporaryPassword, /[^A-Za-z0-9]/, "temporary password missing symbol");
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

describe("deletePortalAccount (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  test("deletes linked records and preserves audit history with a null actor", async () => {
    const target = await createPortalAccount({ email: fixtureEmail("delete-student"), firstName: "Del", lastName: "Student", role: "student", lrn: `8${String(Date.now()).slice(-11)}` });
    const actor = await getDb().insert(users).values({ email: fixtureEmail("delete-admin"), firstName: "Ada", lastName: "Admin", passwordHash: "hash", role: "admin" }).returning({ id: users.id });
    const student = await getDb().query.students.findFirst({ where: eq(students.userId, target.id) });
    assert.ok(student);
    let requestId = "";
    let historyId = "";
    let certificateId = "";
    let auditId = "";
    try {
      await getDb().insert(notifications).values({ userId: target.id, title: "Test", message: "Test" });
      const [request] = await getDb().insert(documentRequests).values({ trackingNumber: `DEL-${Date.now()}`, studentId: student.id, requestedByUserId: target.id, purpose: "Account deletion test request" }).returning({ id: documentRequests.id });
      requestId = request.id;
      const [history] = await getDb().insert(requestStatusHistory).values({ requestId, actorUserId: target.id, toStatus: "pending" }).returning({ id: requestStatusHistory.id });
      historyId = history.id;
      const [certificate] = await getDb().insert(certificates).values({ certificateNumber: `DEL-${Date.now()}`, requestId, studentId: student.id, certificateType: "Test", verificationCode: `DEL-${Date.now()}-${Math.random()}`, qrCodeData: "test" }).returning({ id: certificates.id });
      certificateId = certificate.id;
      const [audit] = await getDb().insert(auditLogs).values({ actorUserId: target.id, actorRole: "student", action: "test", entityType: "user", entityId: target.id, recordHash: `0x${"1".repeat(64)}` }).returning({ id: auditLogs.id });
      auditId = audit.id;

      await deletePortalAccount(target.id, { id: actor[0].id, role: "admin" });

      assert.equal(await getDb().query.users.findFirst({ where: eq(users.id, target.id) }), undefined);
      assert.equal(await getDb().query.students.findFirst({ where: eq(students.id, student.id) }), undefined);
      assert.equal(await getDb().query.documentRequests.findFirst({ where: eq(documentRequests.id, requestId) }), undefined);
      assert.equal(await getDb().query.requestStatusHistory.findFirst({ where: eq(requestStatusHistory.id, historyId) }), undefined);
      assert.equal(await getDb().query.certificates.findFirst({ where: eq(certificates.id, certificateId) }), undefined);
      const retainedAudit = await getDb().query.auditLogs.findFirst({ where: eq(auditLogs.id, auditId) });
      assert.ok(retainedAudit);
      assert.equal(retainedAudit.actorUserId, null);
    } finally {
      if (auditId) await getDb().delete(auditLogs).where(eq(auditLogs.id, auditId));
      await getDb().delete(auditLogs).where(and(eq(auditLogs.entityId, target.id), eq(auditLogs.action, "user.delete")));
      if (requestId) await getDb().delete(documentRequests).where(eq(documentRequests.id, requestId));
      await getDb().delete(notifications).where(eq(notifications.userId, target.id));
      await deleteUsers([target.id, actor[0].id]);
    }
  });

  test("refuses to delete an administrator account", async () => {
    const [admin] = await getDb().insert(users).values({ email: fixtureEmail("admin-delete-guard"), firstName: "A", lastName: "D", passwordHash: "hash", role: "admin" }).returning({ id: users.id });
    try { await assert.rejects(() => deletePortalAccount(admin.id, { id: "other", role: "admin" }), (error: AppError) => error.status === 403); }
    finally { await deleteUsers([admin.id]); }
  });

  test("refuses self-deletion", async () => {
    const user = await createPortalAccount({ email: fixtureEmail("self-delete"), firstName: "S", lastName: "D", role: "registrar" });
    try { await assert.rejects(() => deletePortalAccount(user.id, { id: user.id, role: "registrar" }), (error: AppError) => error.status === 409); }
    finally { await deleteUsers([user.id]); }
  });

  test("deletes a registrar and unlinks their assignments from surviving requests", async () => {
    const registrar = await createPortalAccount({ email: fixtureEmail("delete-registrar"), firstName: "R", lastName: "D", role: "registrar" });
    const owner = await createPortalAccount({ email: fixtureEmail("request-owner"), firstName: "O", lastName: "W", role: "student", lrn: `7${String(Date.now()).slice(-11)}` });
    const student = await getDb().query.students.findFirst({ where: eq(students.userId, owner.id) });
    assert.ok(student);
    let requestId = "";
    try {
      const [request] = await getDb().insert(documentRequests).values({ trackingNumber: `ASSIGN-${Date.now()}`, studentId: student.id, requestedByUserId: owner.id, assignedToUserId: registrar.id, purpose: "Surviving test request" }).returning({ id: documentRequests.id });
      requestId = request.id;
      const [actor] = await getDb().insert(users).values({ email: fixtureEmail("request-admin"), firstName: "A", lastName: "D", passwordHash: "hash", role: "admin" }).returning({ id: users.id });
      try {
        await deletePortalAccount(registrar.id, { id: actor.id, role: "admin" });
        assert.equal((await getDb().query.documentRequests.findFirst({ where: eq(documentRequests.id, requestId) }))?.assignedToUserId, null);
      } finally {
        await getDb().delete(auditLogs).where(and(eq(auditLogs.entityId, registrar.id), eq(auditLogs.action, "user.delete")));
        await deleteUsers([actor.id]);
      }
    } finally {
      if (requestId) await getDb().delete(documentRequests).where(eq(documentRequests.id, requestId));
      await deleteUsers([registrar.id, owner.id]);
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
