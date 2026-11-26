import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { and, eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { auditLogs, students, users } = await import("@/db/schema");
const { deleteStudentRecord, updateStudentRecord } = await import("@/lib/services/student-records");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

async function createStudentFixture() {
  fixtureIndex += 1;
  const db = getDb();
  const lrn = `9${String(Date.now() + fixtureIndex).slice(-11)}`;
  const [user] = await db
    .insert(users)
    .values({
      email: `student-record-${Date.now()}-${fixtureIndex}@example.test`,
      lrn,
      passwordHash: "not-a-real-hash",
      firstName: "Jamie",
      lastName: "Santos",
      role: "student",
      registrationStatus: "approved",
    })
    .returning({ id: users.id });
  const [student] = await db
    .insert(students)
    .values({ userId: user.id, lrn, firstName: "Jamie", lastName: "Santos" })
    .returning({ id: students.id });
  return { userId: user.id, studentId: student.id, lrn };
}

async function cleanup(userId: string) {
  const db = getDb();
  await db.delete(students).where(eq(students.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

describe("updateStudentRecord last school year (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("persists the last school year attended", async () => {
    const fixture = await createStudentFixture();
    try {
      await updateStudentRecord(fixture.studentId, {
        lrn: fixture.lrn,
        firstName: "Jamie",
        lastName: "Santos",
        lastSchoolYearAttended: "2025-2026",
        enrollmentStatus: "enrolled",
      });
      const student = await getDb().query.students.findFirst({
        where: eq(students.id, fixture.studentId),
      });
      assert.equal(student?.lastSchoolYearAttended, "2025-2026");
    } finally {
      await cleanup(fixture.userId);
    }
  });

  it("clears the last school year when the registrar blanks the field", async () => {
    const fixture = await createStudentFixture();
    try {
      const values = {
        lrn: fixture.lrn,
        firstName: "Jamie",
        lastName: "Santos",
        enrollmentStatus: "enrolled" as const,
      };
      await updateStudentRecord(fixture.studentId, { ...values, lastSchoolYearAttended: "2025-2026" });
      await updateStudentRecord(fixture.studentId, { ...values, lastSchoolYearAttended: "   " });
      const student = await getDb().query.students.findFirst({
        where: eq(students.id, fixture.studentId),
      });
      assert.equal(student?.lastSchoolYearAttended, null);
    } finally {
      await cleanup(fixture.userId);
    }
  });

  it("keeps the last school year when the PATCH omits the key entirely", async () => {
    const fixture = await createStudentFixture();
    try {
      await updateStudentRecord(fixture.studentId, {
        lrn: fixture.lrn,
        firstName: "Jamie",
        lastName: "Santos",
        lastSchoolYearAttended: "2025-2026",
        enrollmentStatus: "enrolled",
      });
      await updateStudentRecord(fixture.studentId, {
        lrn: fixture.lrn,
        firstName: "Jamie",
        lastName: "Santos",
        enrollmentStatus: "transferred",
      });
      const student = await getDb().query.students.findFirst({
        where: eq(students.id, fixture.studentId),
      });
      assert.equal(student?.lastSchoolYearAttended, "2025-2026");
      assert.equal(student?.enrollmentStatus, "transferred");
    } finally {
      await cleanup(fixture.userId);
    }
  });
});

describe("deleteStudentRecord (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("deletes the linked portal account", async () => {
    const fixture = await createStudentFixture();
    const [actor] = await getDb().insert(users).values({ email: `registrar-delete-${Date.now()}@example.test`, firstName: "R", lastName: "D", passwordHash: "hash", role: "registrar" }).returning({ id: users.id });
    try {
      assert.deepEqual(await deleteStudentRecord(fixture.studentId, { id: actor.id, role: "registrar" }), { id: fixture.studentId });
      assert.equal(await getDb().query.users.findFirst({ where: eq(users.id, fixture.userId) }), undefined);
      assert.equal(await getDb().query.students.findFirst({ where: eq(students.id, fixture.studentId) }), undefined);
    } finally {
      await getDb().delete(auditLogs).where(and(eq(auditLogs.entityId, fixture.userId), eq(auditLogs.action, "user.delete")));
      await cleanup(fixture.userId);
      await getDb().delete(users).where(eq(users.id, actor.id));
    }
  });
});
