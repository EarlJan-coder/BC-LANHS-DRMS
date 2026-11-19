import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { apiGuardEffects } = await import("@/lib/api-guards");
const { systemHealthEffects } = await import("@/lib/services/system-health");
const { GET } = await import("@/app/api/settings/status/route");

type CurrentUser = NonNullable<Awaited<ReturnType<typeof apiGuardEffects.resolveUser>>>;

function mockUser(user: CurrentUser | null) {
  mock.method(apiGuardEffects, "resolveUser", async () => user);
}

afterEach(() => {
  mock.restoreAll();
});

describe("settings status route", () => {
  it("rejects an unauthenticated GET with 401", async () => {
    const response = await GET();
    assert.equal(response.status, 401);
  });

  it("rejects a non-admin GET with 403", async () => {
    mockUser({ id: "route-test-registrar", role: "registrar" } as unknown as CurrentUser);
    const response = await GET();
    assert.equal(response.status, 403);
  });

  it("returns the health checks for an admin", async () => {
    mockUser({ id: "route-test-admin", role: "admin" } as unknown as CurrentUser);
    systemHealthEffects.pingStorage = async () => undefined;
    systemHealthEffects.checkProofs = async () => ({ configured: true, reachable: true, pending: 0, failed: 0 });

    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.length, 4);
    assert.deepEqual(
      body.data.map((check: { key: string }) => check.key),
      ["storage", "sign-in", "email", "proofs"],
    );
  });
});
