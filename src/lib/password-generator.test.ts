import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTemporaryPassword } from "@/lib/password-generator";

describe("generateTemporaryPassword", () => {
  it("meets the strong password policy: uppercase, lowercase, number, and symbol", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const password = generateTemporaryPassword();
      assert.equal(password.length, 12);
      assert.match(password, /[A-Z]/, "missing uppercase letter");
      assert.match(password, /[a-z]/, "missing lowercase letter");
      assert.match(password, /[0-9]/, "missing number");
      assert.match(password, /[^A-Za-z0-9]/, "missing symbol");
    }
  });

  it("honors a custom length while keeping every character class", () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const password = generateTemporaryPassword(16);
      assert.equal(password.length, 16);
      assert.match(password, /[A-Z]/, "missing uppercase letter");
      assert.match(password, /[a-z]/, "missing lowercase letter");
      assert.match(password, /[0-9]/, "missing number");
      assert.match(password, /[^A-Za-z0-9]/, "missing symbol");
    }
  });
});
