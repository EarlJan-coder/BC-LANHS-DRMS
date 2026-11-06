import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formSubmitHref } from "@/lib/pending-form";

describe("formSubmitHref", () => {
  it("appends form fields as a query string", () => {
    assert.equal(
      formSubmitHref("/registrar/requests", [
        ["q", "R-001"],
        ["status", "approved"],
      ]),
      "/registrar/requests?q=R-001&status=approved",
    );
  });

  it("keeps empty values, matching native GET form submission", () => {
    assert.equal(
      formSubmitHref("/registrar/requests", [
        ["q", ""],
        ["status", ""],
        ["documentType", ""],
      ]),
      "/registrar/requests?q=&status=&documentType=",
    );
  });

  it("encodes values like application/x-www-form-urlencoded (space as +)", () => {
    assert.equal(formSubmitHref("/x", [["q", "two words"]]), "/x?q=two+words");
    assert.equal(formSubmitHref("/x", [["q", "a+b&c=d"]]), "/x?q=a%2Bb%26c%3Dd");
    assert.equal(formSubmitHref("/x", [["q", "100%"]]), "/x?q=100%25");
  });

  it("omits the query separator when the form has no fields", () => {
    assert.equal(formSubmitHref("/registrar/requests", []), "/registrar/requests");
  });

  it("replaces a stale query string on the action", () => {
    assert.equal(
      formSubmitHref("/registrar/requests?stale=1", [["q", "a"]]),
      "/registrar/requests?q=a",
    );
  });

  it("preserves repeated field names", () => {
    assert.equal(
      formSubmitHref("/x", [
        ["tag", "a"],
        ["tag", "b"],
      ]),
      "/x?tag=a&tag=b",
    );
  });

  it("keeps a fragment after the query, matching native GET submission", () => {
    assert.equal(formSubmitHref("/x#results", [["q", "a"]]), "/x?q=a#results");
  });
});
