import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-32b";

import { createSessionToken, verifySessionToken } from "@/lib/session-token";

const USER_ID = "00b1be53-d8ca-4a24-adb6-bc4aa4d8987d";

describe("session token token_version", () => {
  it("round-trips the token version claim", async () => {
    const token = await createSessionToken(USER_ID, 3);
    const session = await verifySessionToken(token);
    assert.equal(session.sub, USER_ID);
    assert.equal(session.tokenVersion, 3);
  });

  it("round-trips version 0 (fresh accounts)", async () => {
    const token = await createSessionToken(USER_ID, 0);
    const session = await verifySessionToken(token);
    assert.equal(session.tokenVersion, 0);
  });

  it("reports a null version for tokens minted before the claim existed", async () => {
    // Old-format session (no claim) must never match a user's stored version.
    const legacy = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    const session = await verifySessionToken(legacy);
    assert.equal(session.sub, USER_ID);
    assert.equal(session.tokenVersion, null);
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken(USER_ID, 0);
    await assert.rejects(() => verifySessionToken(`${token}x`));
  });
});
