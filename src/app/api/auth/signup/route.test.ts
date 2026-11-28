import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { and, eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { notifications, students, users, systemSettings } = await import("@/db/schema");
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
    studentStatus: "student",
    currentSchoolYear: "2025-2026",
    lastSchoolYearAttended: "",
    password: "Registration-Test-Passw0rd!",
    acceptedTerms: true,
    acceptedPrivacy: true,
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

  it("creates an alumni account without an LRN", async () => {
    const payload = signupPayload({ studentStatus: "alumni", lastSchoolYearAttended: "2024-2025", currentSchoolYear: "" });
    delete (payload as Record<string, unknown>).lrn;
    let createdUserId = "";
    try {
      const response = await postSignup(payload);
      assert.equal(response.status, 201);
      const user = await getDb().query.users.findFirst({ where: eq(users.email, payload.email) });
      assert.ok(user);
      createdUserId = user.id;
      assert.equal(user.lrn, null);
      const student = await getDb().query.students.findFirst({ where: eq(students.userId, user.id) });
      assert.equal(student?.lrn, null);
      assert.equal(student?.studentType, "alumni");
    } finally {
      await cleanup(createdUserId ? [createdUserId] : []);
    }
  });

  it("keeps the LRN format requirement for alumni and requires an LRN for students", async () => {
    const invalidAlumni = await postSignup(signupPayload({ studentStatus: "alumni", lastSchoolYearAttended: "2024-2025", currentSchoolYear: "", lrn: "12" }));
    assert.equal(invalidAlumni.status, 400);
    const noStudentLrn = signupPayload();
    delete (noStudentLrn as Record<string, unknown>).lrn;
    assert.equal((await postSignup(noStudentLrn)).status, 400);
  });

  it("rejects a weak password that misses the character-class rules", async () => {
    const payload = signupPayload({ password: "weakpass1234" });
    const response = await postSignup(payload);

    try {
      assert.equal(response.status, 400);
      const body = await response.json();
      assert.match(body.error, /uppercase letter/i);
    } finally {
      // The request must create nothing; clean up anyway so a regression
      // cannot leak a fixture account into the database.
      const created = await getDb().query.users.findFirst({ where: eq(users.email, payload.email) });
      await cleanup(created ? [created.id] : []);
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

  it("rejects signups with a friendly message while registration is closed", async () => {
    const db = getDb();
    const previous = await db.select().from(systemSettings);
    let rejected = false;

    try {
      await db
        .insert(systemSettings)
        .values({ key: "signupOpen", value: false })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: false } });

      const response = await postSignup(signupPayload());
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), {
        error: "Registration is currently closed. Please contact the registrar.",
      });
      rejected = true;
    } finally {
      await db.delete(systemSettings);
      if (previous.length) await db.insert(systemSettings).values(previous);
      if (!rejected) throw new Error("expected signup to be rejected while closed");
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

  it("persists middle name, phone, composed address, and current school year on the student record", async () => {
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
      assert.equal(student?.lastSchoolYearAttended, null);
      assert.equal(student?.currentSchoolYear, "2025-2026");
      assert.equal(student?.studentType, "current");
    } finally {
      await cleanup(createdUserId ? [createdUserId] : []);
    }
  });

  it("rejects a student signup without a current school year", async () => {
    const payload = signupPayload({ currentSchoolYear: "" });
    const response = await postSignup(payload);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "Enter your current school year.");
  });

  it("rejects an alumni signup without a last school year attended", async () => {
    const response = await postSignup(signupPayload({ studentStatus: "alumni", lastSchoolYearAttended: "" }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Last school year attended is required.");
  });

  it("stores alumni status and the last school year on the student record", async () => {
    const payload = signupPayload({ studentStatus: "alumni", lastSchoolYearAttended: "2024-2025", currentSchoolYear: "" });
    let userId = "";
    try {
      assert.equal((await postSignup(payload)).status, 201);
      const user = await getDb().query.users.findFirst({ where: eq(users.email, payload.email) });
      assert.ok(user);
      userId = user.id;
      const student = await getDb().query.students.findFirst({ where: eq(students.userId, user.id) });
      assert.equal(student?.studentType, "alumni");
      assert.equal(student?.lastSchoolYearAttended, "2024-2025");
      assert.equal(student?.currentSchoolYear, null);
    } finally { await cleanup(userId ? [userId] : []); }
  });

  it("a student signup may omit the last school year attended", async () => {
    const payload = signupPayload({ lastSchoolYearAttended: "" });
    let userId = "";
    try {
      assert.equal((await postSignup(payload)).status, 201);
      userId = (await getDb().query.users.findFirst({ where: eq(users.email, payload.email) }))?.id ?? "";
    } finally { await cleanup(userId ? [userId] : []); }
  });

  it("an alumni signup may omit the current school year", async () => {
    const payload = signupPayload({ studentStatus: "alumni", lastSchoolYearAttended: "2024-2025", currentSchoolYear: "" });
    let userId = "";
    try {
      assert.equal((await postSignup(payload)).status, 201);
      userId = (await getDb().query.users.findFirst({ where: eq(users.email, payload.email) }))?.id ?? "";
    } finally { await cleanup(userId ? [userId] : []); }
  });

  it("rejects signup when the Terms and Conditions are not accepted", async () => {
    const response = await postSignup(signupPayload({ acceptedTerms: false }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /terms and conditions/i);
  });

  it("rejects signup when the Privacy Notice is not accepted", async () => {
    const response = await postSignup(signupPayload({ acceptedPrivacy: false }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /privacy notice/i);
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
