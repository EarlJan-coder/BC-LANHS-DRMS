import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { NextRequest } = await import("next/server");
const { proxy } = await import("@/proxy");
const { createSessionToken } = await import("@/lib/session-token");
const { getDb, closeDb } = await import("@/db");
const { users } = await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const { randomUUID } = await import("node:crypto");

const db = getDb();

after(async () => {
  await closeDb();
});

function request(path: string, cookie: string) {
  return new NextRequest(new Request(`http://localhost:3000${path}`, { headers: { cookie } }));
}

describe("proxy mustChangePassword gate (integration, local DB)", () => {
  async function seedUser(mustChangePassword: boolean) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: `proxy-mcp-${id}@test.local`,
      passwordHash: "not-a-real-hash",
      firstName: "Proxy",
      lastName: "MustChange",
      role: "student",
      tokenVersion: 0,
      mustChangePassword,
    });
    return { id, token: await createSessionToken(id, 0) };
  }

  it("redirects a user with mustChangePassword to /change-password", async () => {
    const { id, token } = await seedUser(true);
    try {
      const response = await proxy(request("/student/dashboard", `lanhs_session=${token}`));
      assert.equal(response.status, 307, "flagged user is redirected");
      assert.ok(
        response.headers.get("location")?.endsWith("/change-password"),
        "redirect targets /change-password",
      );
    } finally {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("allows /change-password and /api/profile/password while the flag is set", async () => {
    const { id, token } = await seedUser(true);
    try {
      const page = await proxy(request("/change-password", `lanhs_session=${token}`));
      assert.equal(page.status, 200, "/change-password remains reachable");
      assert.equal(page.headers.get("location"), null, "/change-password is not a redirect");

      const api = await proxy(request("/api/profile/password", `lanhs_session=${token}`));
      assert.equal(api.status, 200, "/api/profile/password remains reachable");
      assert.equal(api.headers.get("location"), null, "/api/profile/password is not a redirect");
    } finally {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("does not redirect a user without the flag", async () => {
    const { id, token } = await seedUser(false);
    try {
      const response = await proxy(request("/student/dashboard", `lanhs_session=${token}`));
      assert.equal(response.status, 200, "unflagged user passes the proxy");
      assert.equal(response.headers.get("location"), null, "unflagged user is not redirected");
    } finally {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("returns 403 for other API routes while the flag is set", async () => {
    const { id, token } = await seedUser(true);
    try {
      const response = await proxy(request("/api/profile", `lanhs_session=${token}`));
      assert.equal(response.status, 403, "flagged API request is rejected");
      const body = await response.json();
      assert.equal(body.error, "Change your password before continuing.");
    } finally {
      await db.delete(users).where(eq(users.id, id));
    }
  });
});

describe("proxy token_version revocation (integration, local DB)", () => {
  it("lets a matching cookie through, rejects it after the version bump, and preserves ?next=", async () => {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: `proxy-test-${id}@test.local`,
      passwordHash: "not-a-real-hash",
      firstName: "Proxy",
      lastName: "Test",
      role: "student",
      tokenVersion: 0,
    });

    try {
      const token = await createSessionToken(id, 0);

      const ok = await proxy(request("/api/students/import/template", `lanhs_session=${token}`));
      assert.equal(ok.status, 200, "valid session passes the proxy");

      // Simulate logout: the version bump must kill the old cookie at the
      // proxy boundary, including for routes with no in-route user check.
      await db.update(users).set({ tokenVersion: 1 }).where(eq(users.id, id));

      const revokedApi = await proxy(request("/api/students/import/template", `lanhs_session=${token}`));
      assert.equal(revokedApi.status, 401, "revoked cookie is rejected on API routes");

      const revokedPage = await proxy(request("/registrar/students", `lanhs_session=${token}`));
      assert.equal(revokedPage.status, 307, "revoked cookie is redirected on page routes");
      assert.ok(
        revokedPage.headers.get("location")?.includes("/sign-in?next=%2Fregistrar%2Fstudents"),
        "redirect keeps the original path in ?next=",
      );

      // A token minted at the new version works again.
      const fresh = await createSessionToken(id, 1);
      const freshOk = await proxy(request("/api/students/import/template", `lanhs_session=${fresh}`));
      assert.equal(freshOk.status, 200, "token minted at the current version passes");
    } finally {
      await db.delete(users).where(eq(users.id, id));
    }
  });
});
