import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { users } = await import("@/db/schema");
const { POST } = await import("@/app/api/auth/login/route");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

async function createUser(registrationStatus: "pending" | "declined") {
  fixtureIndex += 1;
  const id = randomUUID();
  const password = "login-registration-password";
  const [user] = await getDb()
    .insert(users)
    .values({
      id,
      email: `login-registration-${Date.now()}-${fixtureIndex}@example.test`,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: "Login",
      lastName: "Registration",
      role: "student",
      registrationStatus,
    })
    .returning({ id: users.id, email: users.email });

  return { ...user, password };
}

async function login(identifier: string, password: string) {
  return POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    }),
  );
}

describe("login registration gate (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("shows the pending message only after the password verifies and starts no session", async () => {
    const user = await createUser("pending");
    try {
      const badPassword = await login(user.email, "incorrect-password");
      assert.equal(badPassword.status, 401);
      assert.deepEqual(await badPassword.json(), { error: "Email/LRN or password is incorrect." });

      const response = await login(user.email, user.password);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "Your registration is still pending approval." });
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      await getDb().delete(users).where(inArray(users.id, [user.id]));
    }
  });

  it("rejects a declined registration after the password verifies", async () => {
    const user = await createUser("declined");
    try {
      const response = await login(user.email, user.password);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "Your registration was declined. Contact the registrar." });
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      await getDb().delete(users).where(eq(users.id, user.id));
    }
  });
});
