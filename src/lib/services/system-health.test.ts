import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { systemHealthEffects, getSystemHealth } = await import("@/lib/services/system-health");

const originalEffects = { ...systemHealthEffects };
const originalEnv = {
  sessionSecret: process.env.SESSION_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
};

function healthyEffects() {
  systemHealthEffects.pingStorage = async () => undefined;
  systemHealthEffects.checkProofs = async () => ({ configured: true, reachable: true, pending: 0, failed: 0 });
}

afterEach(() => {
  Object.assign(systemHealthEffects, originalEffects);
  if (originalEnv.sessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalEnv.sessionSecret;
  if (originalEnv.resendApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalEnv.resendApiKey;
});

describe("getSystemHealth", () => {
  it("returns the four plain-language areas", async () => {
    healthyEffects();
    process.env.RESEND_API_KEY = "test-key";

    const checks = await getSystemHealth();
    assert.deepEqual(
      checks.map((check) => [check.key, check.title]),
      [
        ["storage", "Storage"],
        ["sign-in", "Sign-in"],
        ["email", "Email notifications"],
        ["proofs", "Proof certificates"],
      ],
    );
  });

  it("reports everything working with reassuring sentences", async () => {
    healthyEffects();
    process.env.RESEND_API_KEY = "test-key";

    const checks = await getSystemHealth();
    for (const check of checks) {
      assert.equal(check.state, "working", `${check.key} should be working`);
      assert.equal(check.needsDeveloper, false, `${check.key} should not need a developer`);
      assert.equal(check.technical, null);
    }
  });

  it("asks for a developer when the database is down, and sign-in with it", async () => {
    healthyEffects();
    process.env.RESEND_API_KEY = "test-key";
    systemHealthEffects.pingStorage = async () => {
      throw new Error("connection refused");
    };

    const checks = await getSystemHealth();
    const storage = checks.find((check) => check.key === "storage");
    const signIn = checks.find((check) => check.key === "sign-in");

    assert.equal(storage?.state, "attention");
    assert.equal(storage?.needsDeveloper, true);
    assert.match(storage?.technical ?? "", /connection refused/);
    assert.equal(signIn?.state, "attention");
    assert.equal(signIn?.needsDeveloper, true);
  });

  it("asks for a developer when the sign-in secret is missing", async () => {
    healthyEffects();
    process.env.RESEND_API_KEY = "test-key";
    delete process.env.SESSION_SECRET;

    const checks = await getSystemHealth();
    const signIn = checks.find((check) => check.key === "sign-in");

    assert.equal(signIn?.state, "attention");
    assert.equal(signIn?.needsDeveloper, true);
    assert.match(signIn?.technical ?? "", /SESSION_SECRET/);
  });

  it("asks for a developer when the email key is missing", async () => {
    healthyEffects();
    delete process.env.RESEND_API_KEY;

    const checks = await getSystemHealth();
    const email = checks.find((check) => check.key === "email");

    assert.equal(email?.state, "attention");
    assert.equal(email?.needsDeveloper, true);
    assert.match(email?.technical ?? "", /RESEND_API_KEY/);
  });

  it("asks for a developer when proofs are not configured or unreachable", async () => {
    healthyEffects();
    process.env.RESEND_API_KEY = "test-key";

    systemHealthEffects.checkProofs = async () => ({ configured: false, reachable: false, pending: 0, failed: 0 });
    let proofs = (await getSystemHealth()).find((check) => check.key === "proofs");
    assert.equal(proofs?.state, "attention");
    assert.equal(proofs?.needsDeveloper, true);

    systemHealthEffects.checkProofs = async () => ({
      configured: true,
      reachable: false,
      pending: 0,
      failed: 0,
      error: "rpc timeout",
    });
    proofs = (await getSystemHealth()).find((check) => check.key === "proofs");
    assert.equal(proofs?.state, "attention");
    assert.equal(proofs?.needsDeveloper, true);
    assert.match(proofs?.technical ?? "", /rpc timeout/);
  });

  it("mentions pending proofs without alarming the admin", async () => {
    healthyEffects();
    process.env.RESEND_API_KEY = "test-key";
    systemHealthEffects.checkProofs = async () => ({ configured: true, reachable: true, pending: 3, failed: 1 });

    const checks = await getSystemHealth();
    const proofs = checks.find((check) => check.key === "proofs");

    assert.equal(proofs?.state, "working");
    assert.equal(proofs?.needsDeveloper, false);
    assert.match(proofs?.sentence ?? "", /still being recorded/);
  });
});
