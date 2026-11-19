import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { cronEffects, GET } = await import("@/app/api/cron/retry-proofs/route");

const originalEffects = { ...cronEffects };
const originalSecret = process.env.CRON_SECRET;

function callGet(authorization?: string) {
  return GET(
    new Request("http://localhost/api/cron/retry-proofs", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

afterEach(() => {
  Object.assign(cronEffects, originalEffects);
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("scheduled retry route", () => {
  it("refuses to run when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await callGet("Bearer anything");
    assert.equal(response.status, 503);
  });

  it("rejects a wrong secret with 401", async () => {
    process.env.CRON_SECRET = "right-secret";
    const response = await callGet("Bearer wrong-secret");
    assert.equal(response.status, 401);
  });

  it("skips without touching the chain when automatic fixing is off", async () => {
    process.env.CRON_SECRET = "right-secret";
    cronEffects.getSettings = async () => ({
      signupOpen: true,
      emailFromName: "LANHS DRMS",
      emailFromAddress: "no-reply@lanhsdrms.online",
      autoFixProofs: false,
    });
    let retryCalled = false;
    cronEffects.retryProofs = async () => {
      retryCalled = true;
      return { attempted: 0, submitted: 0, failed: 0 };
    };

    const response = await callGet("Bearer right-secret");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.skipped, true);
    assert.equal(retryCalled, false);
  });

  it("retries pending proofs when automatic fixing is on", async () => {
    process.env.CRON_SECRET = "right-secret";
    cronEffects.getSettings = async () => ({
      signupOpen: true,
      emailFromName: "LANHS DRMS",
      emailFromAddress: "no-reply@lanhsdrms.online",
      autoFixProofs: true,
    });
    let retryCalled = false;
    cronEffects.retryProofs = async () => {
      retryCalled = true;
      return { attempted: 2, submitted: 1, failed: 1 };
    };

    const response = await callGet("Bearer right-secret");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.skipped, false);
    assert.deepEqual(body.retry, { attempted: 2, submitted: 1, failed: 1 });
    assert.equal(retryCalled, true);
  });
});
