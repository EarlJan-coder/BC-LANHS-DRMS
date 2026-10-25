import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRedirectPath } from "@/lib/utils";

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

  it("rejects malformed or missing values", () => {
    assert.equal(sanitizeRedirectPath(undefined), undefined);
    assert.equal(sanitizeRedirectPath(["/a", "/b"]), undefined);
    assert.equal(sanitizeRedirectPath("registrar/x"), undefined);
    assert.equal(sanitizeRedirectPath(""), undefined);
    assert.equal(sanitizeRedirectPath(42), undefined);
  });
});
