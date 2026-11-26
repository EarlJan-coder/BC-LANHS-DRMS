import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { rowMatchesQuery } from "@/lib/table-search";

describe("rowMatchesQuery", () => {
  test("empty query matches everything", () => {
    assert.equal(rowMatchesQuery("anything", ""), true);
    assert.equal(rowMatchesQuery("anything", "   "), true);
  });
  test("matches case-insensitively as a substring", () => {
    assert.equal(rowMatchesQuery("FORM 137 — Juan Dela Cruz", "form 137"), true);
  });
  test("ignores whitespace around the query", () => {
    assert.equal(rowMatchesQuery("Transcript", "  transcript  "), true);
  });
  test("returns false when the text does not contain the query", () => {
    assert.equal(rowMatchesQuery("Transcript", "form 138"), false);
  });
});
