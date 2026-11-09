import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { POST } from "./route";

it("unauthenticated decision is rejected", async () => {
  const response = await POST(
    new Request(`http://localhost/api/registrations/${randomUUID()}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", note: "Verified." }),
    }),
    { params: Promise.resolve({ id: randomUUID() }) },
  );

  assert.equal(response.status, 401);
});
