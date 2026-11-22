import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentFee, humanizeStatus, capitalizeFirst, roleLabel, sanitizeRedirectPath } from "@/lib/utils";

describe("formatDocumentFee", () => {
  it("shows No fee when the document type is free", () => {
    assert.equal(formatDocumentFee(0), "No fee");
  });

  it("formats positive fees as PHP with two decimals", () => {
    assert.equal(formatDocumentFee(150), "PHP 150.00");
    assert.equal(formatDocumentFee(99.5), "PHP 99.50");
    assert.equal(formatDocumentFee(0.25), "PHP 0.25");
  });
});

describe("humanizeStatus", () => {
  it("capitalizes enum values and expands underscores", () => {
    assert.equal(humanizeStatus("pending"), "Pending");
    assert.equal(humanizeStatus("ready_for_pickup"), "Ready For Pickup");
    assert.equal(humanizeStatus("verified"), "Verified");
    assert.equal(humanizeStatus("inactive"), "Inactive");
  });

  it("leaves empty strings untouched", () => {
    assert.equal(humanizeStatus(""), "");
  });
});

describe("capitalizeFirst", () => {
  it("capitalizes only the first letter of a display value", () => {
    assert.equal(capitalizeFirst("referenceId, action, actorRole"), "ReferenceId, action, actorRole");
    assert.equal(capitalizeFirst("pending"), "Pending");
    assert.equal(capitalizeFirst(""), "");
  });
});

describe("roleLabel", () => {
  it("uses the canonical role labels", () => {
    assert.equal(roleLabel("admin"), "Administrator");
    assert.equal(roleLabel("student"), "Student");
    assert.equal(roleLabel("registrar"), "Registrar");
  });

  it("falls back to humanized text for unknown values", () => {
    assert.equal(roleLabel("super_user"), "Super User");
  });
});

describe("sanitizeRedirectPath", () => {
  it("accepts same-origin portal paths", () => {
    assert.equal(sanitizeRedirectPath("/registrar/students"), "/registrar/students");
    assert.equal(sanitizeRedirectPath("/dashboard?tab=x"), "/dashboard?tab=x");
    assert.equal(sanitizeRedirectPath("/student/profile"), "/student/profile");
  });

  it("rejects open-redirect vectors", () => {
    assert.equal(sanitizeRedirectPath("https://evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("//evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("/\\evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("\\\\evil.com"), undefined);
  });

  it("rejects control characters that the WHATWG URL parser would strip", () => {
    // "?next=/%09/evil.com" decodes to "/\t/evil.com". The URL parser strips
    // tabs/newlines, turning it into the cross-origin "//evil.com".
    assert.equal(sanitizeRedirectPath("/\t/evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("/\n/evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("/\r/evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("/\u0000/evil.com"), undefined);
    assert.equal(sanitizeRedirectPath("/dashboard\u0009"), undefined);
  });

  it("rejects API targets (a browser should not navigate to JSON endpoints)", () => {
    assert.equal(sanitizeRedirectPath("/api/users"), undefined);
    assert.equal(sanitizeRedirectPath("/api"), undefined);
  });

  it("rejects the internal change-password screen as a post-login target", () => {
    // A signed-out hit on /change-password bounces to
    // /sign-in?next=/change-password (the form's post-logout refresh, a
    // back-navigation, or a restored tab). Honoring that target after login
    // re-opens the "Set a new password" screen even when mustChangePassword
    // is already cleared. The proxy gate routes flagged users to
    // /change-password from any protected page anyway, so landing on the
    // role dashboard first is always safe.
    assert.equal(sanitizeRedirectPath("/change-password"), undefined);
    assert.equal(sanitizeRedirectPath("/change-password?tab=x"), undefined);
    assert.equal(sanitizeRedirectPath("/change-password/extra"), undefined);
  });

  it("rejects malformed or missing values", () => {
    assert.equal(sanitizeRedirectPath(undefined), undefined);
    assert.equal(sanitizeRedirectPath(["/a", "/b"]), undefined);
    assert.equal(sanitizeRedirectPath("registrar/x"), undefined);
    assert.equal(sanitizeRedirectPath(""), undefined);
    assert.equal(sanitizeRedirectPath(42), undefined);
  });
});
