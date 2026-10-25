import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { comparePassword } from "@/lib/password";

describe("comparePassword", () => {
  it("accepts the correct password against a real hash", async () => {
    const hash = await bcrypt.hash("correct-horse", 4);
    assert.equal(await comparePassword("correct-horse", hash), true);
  });

  it("rejects a wrong password against a real hash", async () => {
    const hash = await bcrypt.hash("correct-horse", 4);
    assert.equal(await comparePassword("wrong-password", hash), false);
  });

  it("always performs a cost-12 comparison even when the user hash is missing (timing equalizer)", async () => {
    // Login must not reveal account existence via response time: with no user
    // found, the compare runs against the dummy cost-12 hash instead of
    // short-circuiting. A cost-12 bcrypt takes tens of ms; a skipped one ~0.
    const started = process.hrtime.bigint();
    const result = await comparePassword("anything", null);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    assert.equal(result, false);
    assert.ok(elapsedMs >= 10, `expected a bcrypt compare to run, finished in ${elapsedMs.toFixed(2)}ms`);
  });
});
