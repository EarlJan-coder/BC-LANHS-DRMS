import { after, afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { closeDb } = await import("@/db");
const { apiGuardEffects } = await import("@/lib/api-guards");
const { DEFAULT_WORDING } = await import("@/lib/services/certificate-wording-defaults");
const { POST } = await import("@/app/api/document-template/preview/route");

type CurrentUser = NonNullable<Awaited<ReturnType<typeof apiGuardEffects.resolveUser>>>;
type CertTemplateKey = keyof typeof DEFAULT_WORDING;

function mockUser(user: CurrentUser | null) {
  mock.method(apiGuardEffects, "resolveUser", async () => user);
}

function userWithRole(role: "admin" | "registrar" | "student"): CurrentUser {
  return { id: `route-test-${role}`, role } as unknown as CurrentUser;
}

function previewPayload(template: CertTemplateKey, overrides: Record<string, unknown> = {}) {
  const wording = DEFAULT_WORDING[template];
  // The request contract is non-nullable strings ("" drops a title line), but
  // three defaults mark registrarTitle as null ("keep the printed title"), so
  // normalize those to "" the way callers must on the wire.
  return {
    template,
    title: wording.title,
    body: wording.body,
    principalTitle: wording.principalTitle ?? "",
    registrarTitle: wording.registrarTitle ?? "",
    ...overrides,
  };
}

async function callPost(body: unknown) {
  return POST(
    new Request("http://localhost/api/document-template/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await closeDb();
});

describe("document template preview route auth", () => {
  it("rejects an unauthenticated POST with 401", async () => {
    const response = await callPost(previewPayload("good-moral"));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Please sign in to continue." });
  });

  it("rejects non-admin access with 403", async () => {
    mockUser(userWithRole("registrar"));
    const response = await callPost(previewPayload("good-moral"));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "You do not have access to this resource." });
  });
});

describe("document template preview route", () => {
  for (const template of Object.keys(DEFAULT_WORDING) as CertTemplateKey[]) {
    it(`renders the ${template} sample as an inline PDF`, async () => {
      mockUser(userWithRole("admin"));
      const response = await callPost(previewPayload(template));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/pdf");
      assert.match(response.headers.get("content-disposition") ?? "", /^inline;/);
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
    });
  }

  it("renders with the given signatory names", async () => {
    mockUser(userWithRole("admin"));
    const response = await callPost(
      previewPayload("good-moral", { principalName: "Maria Santos", registrarName: "Juan Dela Cruz" }),
    );
    assert.equal(response.status, 200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  });

  it("rejects signatory names longer than 200 characters with 400", async () => {
    mockUser(userWithRole("admin"));
    for (const field of ["principalName", "registrarName"] as const) {
      const response = await callPost(previewPayload("good-moral", { [field]: "N".repeat(201) }));
      assert.equal(response.status, 400, field);
      assert.match((await response.json()).error, /200/);
    }
  });

  it("rejects null wording fields with 400", async () => {
    mockUser(userWithRole("admin"));
    for (const field of ["title", "body", "principalTitle", "registrarTitle"] as const) {
      const response = await callPost(previewPayload("good-moral", { [field]: null }));
      assert.equal(response.status, 400, field);
    }
  });

  it("enforces the save-schema limits on the wording fields", async () => {
    mockUser(userWithRole("admin"));
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ body: "" }, /required/i],
      [{ body: "x".repeat(4001) }, /4000/],
      [{ title: "x".repeat(201) }, /200/],
      [{ principalTitle: "x".repeat(121) }, /120/],
      [{ registrarTitle: "x".repeat(121) }, /120/],
    ];
    for (const [overrides, message] of cases) {
      const response = await callPost(previewPayload("good-moral", overrides));
      assert.equal(response.status, 400, JSON.stringify(overrides).slice(0, 40));
      assert.match((await response.json()).error, message);
    }
  });

  it("maps TooLongBodyError to 400 Body text is too long for this document.", async () => {
    mockUser(userWithRole("admin"));
    // Passes the 4000-character schema limit but overflows the body block.
    const huge = Array.from({ length: 500 }, () => "lorem").join(" ");
    const response = await callPost(previewPayload("good-moral", { body: huge }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Body text is too long for this document." });
  });

  it("rejects an unknown template with 400", async () => {
    mockUser(userWithRole("admin"));
    const response = await callPost(previewPayload("good-moral", { template: "bogus" }));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  });

  it("rejects malformed JSON with 400 Invalid request body.", async () => {
    mockUser(userWithRole("admin"));
    const response = await callPost("{ not json");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid request body." });
  });
});
