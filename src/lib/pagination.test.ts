import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paginateRows, parsePage } from "@/lib/pagination";

describe("pagination", () => {
  it("returns the total count and requested page slice", () => {
    const result = paginateRows(Array.from({ length: 45 }, (_, index) => index + 1), 3, 20);
    assert.equal(result.total, 45);
    assert.equal(result.page, 3);
    assert.equal(result.pageSize, 20);
    assert.deepEqual(result.rows, [41, 42, 43, 44, 45]);
  });

  it("clamps invalid pages to a usable first or final page", () => {
    assert.equal(parsePage("-2"), 1);
    assert.equal(parsePage("invalid"), 1);
    assert.equal(paginateRows([1, 2, 3], 99, 2).page, 2);
  });
});
