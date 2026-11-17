import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { documentTemplateWording } = await import("@/db/schema");
const { apiGuardEffects } = await import("@/lib/api-guards");
const { DEFAULT_WORDING } = await import("@/lib/services/certificate-wording-defaults");
const { GET, PUT, DELETE } = await import("@/app/api/document-template/wording/route");

type CurrentUser = NonNullable<Awaited<ReturnType<typeof apiGuardEffects.resolveUser>>>;

const hasDb = Boolean(process.env.DATABASE_URL);
const TEMPLATE = "good-moral";

type WordingRow = typeof documentTemplateWording.$inferSelect;
let savedRow: WordingRow | undefined;

function mockUser(user: CurrentUser | null) {
  mock.method(apiGuardEffects, "resolveUser", async () => user);
}

function userWithRole(role: "admin" | "registrar" | "student"): CurrentUser {
  return { id: `route-test-${role}`, role } as unknown as CurrentUser;
}

function putPayload(overrides: Record<string, unknown> = {}) {
  return { template: TEMPLATE, ...DEFAULT_WORDING[TEMPLATE], ...overrides };
}

async function callPut(body: unknown) {
  return PUT(
    new Request("http://localhost/api/document-template/wording", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function callDelete(query: string) {
  return DELETE(new Request(`http://localhost/api/document-template/wording${query}`, { method: "DELETE" }));
}

async function readRow() {
  const [row] = await getDb()
    .select()
    .from(documentTemplateWording)
    .where(eq(documentTemplateWording.templateKey, TEMPLATE));
  return row;
}

async function clearRow() {
  await getDb().delete(documentTemplateWording).where(eq(documentTemplateWording.templateKey, TEMPLATE));
}

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await closeDb();
});

describe("document template wording route auth", () => {
  it("rejects an unauthenticated GET with 401", async () => {
    const response = await GET();
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Please sign in to continue." });
  });

  for (const role of ["registrar", "student"] as const) {
    it(`rejects ${role} access on every method with 403`, async () => {
      mockUser(userWithRole(role));
      for (const call of [() => GET(), () => callPut(putPayload()), () => callDelete(`?template=${TEMPLATE}`)]) {
        const response = await call();
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { error: "You do not have access to this resource." });
      }
    });
  }
});

describe("document template wording route validation", () => {
  it("rejects an unknown placeholder in the body with 400 naming the placeholders", async () => {
    mockUser(userWithRole("admin"));
    const response = await callPut(putPayload({ body: "Hi {{strand}}" }));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /placeholder/i);
  });

  it("rejects null wording fields with 400", async () => {
    mockUser(userWithRole("admin"));
    for (const field of ["title", "body", "principalTitle", "registrarTitle"] as const) {
      const response = await callPut(putPayload({ [field]: null }));
      assert.equal(response.status, 400, field);
    }
  });

  it("rejects malformed JSON with 400 Invalid request body.", async () => {
    mockUser(userWithRole("admin"));
    const response = await callPut("{ not json");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid request body." });
  });

  it("maps TooLongBodyError to 400 Body text is too long for this document.", async () => {
    mockUser(userWithRole("admin"));
    const huge = Array.from({ length: 500 }, () => "lorem").join(" ");
    const response = await callPut(putPayload({ body: huge }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Body text is too long for this document." });
  });

  it("rejects an unknown or missing template on DELETE with 400", async () => {
    mockUser(userWithRole("admin"));
    for (const query of ["?template=bogus", ""]) {
      const response = await callDelete(query);
      assert.equal(response.status, 400, query);
      assert.equal(typeof (await response.json()).error, "string");
    }
  });
});

describe("document template wording route (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  before(async () => {
    savedRow = await readRow();
    await clearRow();
  });

  after(async () => {
    await clearRow();
    if (savedRow) await getDb().insert(documentTemplateWording).values(savedRow);
  });

  it("returns the effective wording for all five templates", async () => {
    mockUser(userWithRole("admin"));
    const response = await GET();
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.deepEqual(Object.keys(data).sort(), Object.keys(DEFAULT_WORDING).sort());
    for (const wording of Object.values(data) as Record<string, unknown>[]) {
      assert.deepEqual(Object.keys(wording).sort(), ["body", "principalTitle", "registrarTitle", "title"]);
    }
  });

  it("saves the wording on PUT and returns the defaults on DELETE", async () => {
    mockUser(userWithRole("admin"));
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const expected = {
      title: "Route Test Title",
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: defaults.registrarTitle,
    };

    const saved = await callPut({ template: TEMPLATE, ...expected });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { data: expected });

    const removed = await callDelete(`?template=${TEMPLATE}`);
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { data: defaults });
    assert.equal(await readRow(), undefined);
  });
});
