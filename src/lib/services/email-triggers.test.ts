import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const servicesDir = join(process.cwd(), "src", "lib", "services");

function countSendCalls(fileName: string): number {
  const source = readFileSync(join(servicesDir, fileName), "utf8");
  // Count call sites, not the import or the helper's own definition.
  return [...source.matchAll(/await sendWorkflowEmail\(\{/g)].length;
}

describe("email send points (status changes only)", () => {
  it("sends exactly one workflow email from document-requests.ts (the status-change path)", () => {
    assert.equal(countSendCalls("document-requests.ts"), 1);
  });

  it("sends no workflow email from certificates.ts (no email on certificate generation)", () => {
    assert.equal(countSendCalls("certificates.ts"), 0);
  });
});
