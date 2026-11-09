import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAccessWithRegistrationStatus, requiresStudentRegistrationApproval } from "@/lib/registration-access";

describe("role-specific registration approval", () => {
  it("requires approval only for students", () => {
    assert.equal(requiresStudentRegistrationApproval("student"), true);
    assert.equal(requiresStudentRegistrationApproval("registrar"), false);
    assert.equal(requiresStudentRegistrationApproval("admin"), false);
  });

  it("blocks pending and declined students but allows staff regardless of registration status", () => {
    assert.equal(canAccessWithRegistrationStatus("student", "pending"), false);
    assert.equal(canAccessWithRegistrationStatus("student", "declined"), false);
    assert.equal(canAccessWithRegistrationStatus("student", "approved"), true);
    assert.equal(canAccessWithRegistrationStatus("registrar", "pending"), true);
    assert.equal(canAccessWithRegistrationStatus("admin", "declined"), true);
  });
});
