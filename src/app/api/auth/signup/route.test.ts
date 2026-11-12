import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { and, eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { notifications, students, users } = await import("@/db/schema");
const { POST } = await import("@/app/api/auth/signup/route");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

function nextLrn() {
  fixtureIndex += 1;
  return `9${String(Date.now() + fixtureIndex).slice(-11)}`;
}

function signupPayload(overrides: Record<string, string | boolean> = {}) {
  return {
    email: `signup-${Date.now()}-${fixtureIndex}@example.test`,
    lrn: nextLrn(),
    firstName: "Jamie",
    middleName: "Mae",
    lastName: "Santos",
    phone: "09171234567",
    addressCity: "Trece Martires City",
    addressBarangay: "Aguado",
    addressStreetLine: "12 Mabini Street",
    lastSchoolYearAttended: "2025-2026",
    password: "registration-test-password",
    acceptedTerms: true,
    ...overrides,
  };
}

async function postSignup(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function cleanup(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  await db.delete(notifications).where(
    and(eq(notifications.referenceType, "registration"), inArray(notifications.referenceId, ids)),
  );
  await db.delete(students).where(inArray(students.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

describe("student signup (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("creates the user and student record and returns 201 without a session", async () => {
    const payload = signupPayload();
    let createdUserId = "";

    try {
      const response = await postSignup(payload);
      assert.equal(response.status, 201);
      assert.equal(response.headers.get("set-cookie"), null);

      const result = await getDb().query.users.findFirst({ where: eq(users.email, payload.email) });
      assert.ok(result);
      createdUserId = result.id;
      assert.equal(result.registrationStatus, "pending");

      const student = await getDb().query.students.findFirst({ where: eq(students.userId, result.id) });
      assert.ok(student);
      assert.equal(student.lrn, payload.lrn);
      assert.equal(student.firstName, payload.firstName);
    } finally {
      await cleanup(createdUserId ? [createdUserId] : []);
    }
  });

  it("allows multiple accounts to register with the same LRN", async () => {
    const payload = signupPayload();
    const [existing] = await getDb()
      .insert(users)
      .values({
        email: `existing-lrn-${Date.now()}@example.test`,
        lrn: payload.lrn,
        passwordHash: "not-a-real-hash",
        firstName: "Existing",
        lastName: "Account",
        registrationStatus: "approved",
      })
      .returning({ id: users.id });
    let registeredId = "";

    try {
      const response = await postSignup(payload);
      assert.equal(response.status, 201);
      const registered = await getDb().query.users.findFirst({ where: eq(users.email, payload.email) });
      assert.ok(registered);
      registeredId = registered.id;
      assert.equal(registered.lrn, payload.lrn);
    } finally {
      await cleanup([existing.id, ...(registeredId ? [registeredId] : [])]);
    }
  });

  it("returns 409 when the email is already used", async () => {
    const payload = signupPayload();
    const [existing] = await getDb()
      .insert(users)
      .values({
        email: payload.email,
        lrn: nextLrn(),
        passwordHash: "not-a-real-hash",
        firstName: "Existing",
        lastName: "Account",
        registrationStatus: "approved",
      })
      .returning({ id: users.id });

    try {
      const response = await postSignup(payload);
      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: "An account already uses that email." });
    } finally {
      await cleanup([existing.id]);
    }
  });

  it("persists middle name, phone, composed address, and last school year on the student record", async () => {
    const payload = signupPayload();
    let createdUserId = "";

    try {
      const response = await postSignup(payload);
      assert.equal(response.status, 201);
      const user = await getDb().query.users.findFirst({ where: eq(users.email, payload.email) });
      assert.ok(user);
      createdUserId = user.id;
      const student = await getDb().query.students.findFirst({ where: eq(students.userId, user.id) });
      assert.equal(student?.middleName, payload.middleName);
      assert.equal(student?.contactNumber, payload.phone);
      assert.equal(student?.address, "12 Mabini Street, Brgy. Aguado, Trece Martires City");
      assert.equal(student?.lastSchoolYearAttended, "2025-2026");
    } finally {
      await cleanup(createdUserId ? [createdUserId] : []);
    }
  });

  it("rejects signup without a last school year attended", async () => {
    const payload = signupPayload({ lastSchoolYearAttended: "" });
    const response = await postSignup(payload);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /last school year/i);
  });

  it("rejects a city that is not in the offered list", async () => {
    const payload = signupPayload({ addressCity: "Nowhereville" });
    const response = await postSignup(payload);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /city/i);
  });

  it("rejects a barangay that does not belong to the chosen city", async () => {
    const payload = signupPayload({ addressBarangay: "Milagrosa" }); // Milagrosa is Carmona, not Trece Martires
    const response = await postSignup(payload);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /barangay/i);
  });

  for (const field of ["addressCity", "addressBarangay", "addressStreetLine"] as const) {
    it(`rejects signup when ${field} is missing`, async () => {
      const payload = signupPayload();
      delete payload[field];
      const response = await postSignup(payload);
      assert.equal(response.status, 400);
    });
  }
});
