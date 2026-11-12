import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { students, users } = await import("@/db/schema");
const { updateStudentProfile } = await import("@/lib/services/student-profiles");
const { AppError } = await import("@/lib/utils");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

async function createStudentFixture(withStudentRecord: boolean) {
  fixtureIndex += 1;
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({
      email: `profile-${Date.now()}-${fixtureIndex}@example.test`,
      lrn: `9${String(Date.now() + fixtureIndex).slice(-11)}`,
      passwordHash: "not-a-real-hash",
      firstName: "Jamie",
      lastName: "Santos",
      role: "student",
      registrationStatus: "approved",
    })
    .returning({ id: users.id });

  if (withStudentRecord) {
    await db.insert(students).values({
      userId: user.id,
      lrn: `9${String(Date.now() + fixtureIndex).slice(-11)}`,
      firstName: "Jamie",
      lastName: "Santos",
      address: "Old free-text address",
    });
  }

  return user.id;
}

async function cleanup(userId: string) {
  const db = getDb();
  await db.delete(students).where(eq(students.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

describe("updateStudentProfile (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("persists the last school year and the composed address", async () => {
    const userId = await createStudentFixture(true);

    try {
      await updateStudentProfile(userId, {
        lastSchoolYearAttended: "2025-2026",
        addressCity: "Trece Martires City",
        addressBarangay: "Aguado",
        addressStreetLine: "123 Mabini St.",
      });

      const student = await getDb().query.students.findFirst({ where: eq(students.userId, userId) });
      assert.equal(student?.lastSchoolYearAttended, "2025-2026");
      assert.equal(student?.address, "123 Mabini St., Brgy. Aguado, Trece Martires City");
    } finally {
      await cleanup(userId);
    }
  });

  it("updates only the fields that are present", async () => {
    const userId = await createStudentFixture(true);

    try {
      await updateStudentProfile(userId, { contactNumber: "09171234567" });
      const student = await getDb().query.students.findFirst({ where: eq(students.userId, userId) });
      assert.equal(student?.contactNumber, "09171234567");
      assert.equal(student?.lastSchoolYearAttended, null);
      assert.equal(student?.address, "Old free-text address");
    } finally {
      await cleanup(userId);
    }
  });

  it("rejects a partial address update", async () => {
    const userId = await createStudentFixture(true);

    try {
      await assert.rejects(
        () =>
          updateStudentProfile(userId, {
            addressCity: "Tanza",
            addressBarangay: "Biga",
          }),
        (error: unknown) => error instanceof AppError && error.status === 400,
      );
      const student = await getDb().query.students.findFirst({ where: eq(students.userId, userId) });
      assert.equal(student?.address, "Old free-text address");
    } finally {
      await cleanup(userId);
    }
  });

  it("409s when the user has no linked student record", async () => {
    const userId = await createStudentFixture(false);

    try {
      await assert.rejects(
        () => updateStudentProfile(userId, { lastSchoolYearAttended: "2025-2026" }),
        (error: unknown) => error instanceof AppError && error.status === 409,
      );
    } finally {
      await cleanup(userId);
    }
  });

  it("still allows an email-only update without a student record", async () => {
    const userId = await createStudentFixture(false);

    try {
      const db = getDb();
      const before = await db.query.users.findFirst({ where: eq(users.id, userId) });
      await updateStudentProfile(userId, { email: `new-${before?.email}` });
      const after = await db.query.users.findFirst({ where: eq(users.id, userId) });
      assert.equal(after?.email, `new-${before?.email}`);
    } finally {
      await cleanup(userId);
    }
  });
});
