import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSessionValidForUser } from "@/lib/session-token";

describe("isSessionValidForUser", () => {
  it("accepts a token whose version matches the user's stored version", () => {
    assert.equal(isSessionValidForUser({ tokenVersion: 0 }, { tokenVersion: 0 }), true);
    assert.equal(isSessionValidForUser({ tokenVersion: 2 }, { tokenVersion: 2 }), true);
  });

  it("rejects a stale token after the user's version was bumped (revocation)", () => {
    // Logout bumps users.token_version 0 -> 1; a stolen token minted at 0 dies.
    assert.equal(isSessionValidForUser({ tokenVersion: 0 }, { tokenVersion: 1 }), false);
  });

  it("rejects tokens minted before the claim existed (null)", () => {
    assert.equal(isSessionValidForUser({ tokenVersion: null }, { tokenVersion: 0 }), false);
    assert.equal(isSessionValidForUser({ tokenVersion: null }, { tokenVersion: 5 }), false);
  });
});
