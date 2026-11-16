import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq } = await import("drizzle-orm");
const { ZodError } = await import("zod");
const { getDb, closeDb } = await import("@/db");
const { documentTemplateWording } = await import("@/db/schema");
const { getDocumentTemplateWording, saveDocumentTemplateWording, resetDocumentTemplateWording } = await import(
  "@/lib/services/document-template-wording"
);
const { DEFAULT_WORDING } = await import("@/lib/services/certificate-wording-defaults");
const { TooLongBodyError } = await import("@/lib/services/certificate-body-layout");

const hasDb = Boolean(process.env.DATABASE_URL);
const TEMPLATE = "good-moral";
const ENROLMENT = "enrolment-jhs";

type WordingRow = typeof documentTemplateWording.$inferSelect;
const savedRows = new Map<string, WordingRow>();

async function readRow(template: string = TEMPLATE) {
  const [row] = await getDb().select().from(documentTemplateWording).where(eq(documentTemplateWording.templateKey, template));
  return row;
}

async function clearRow(template: string = TEMPLATE) {
  await getDb().delete(documentTemplateWording).where(eq(documentTemplateWording.templateKey, template));
}

before(async () => {
  if (!hasDb) return;
  for (const template of [TEMPLATE, ENROLMENT]) {
    const row = await readRow(template);
    if (row) savedRows.set(template, row);
  }
});

beforeEach(async () => {
  if (hasDb) {
    await clearRow(TEMPLATE);
    await clearRow(ENROLMENT);
  }
});

after(async () => {
  if (hasDb) {
    await clearRow(TEMPLATE);
    await clearRow(ENROLMENT);
    for (const row of savedRows.values()) {
      await getDb().insert(documentTemplateWording).values(row);
    }
  }
  await closeDb();
});

describe("document template wording (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("saves only fields that differ from the default", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const saved = await saveDocumentTemplateWording({
      template: TEMPLATE,
      title: "X",
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: defaults.registrarTitle,
    });
    assert.equal(saved.title, "X");
    assert.equal(saved.body, defaults.body);

    const row = await readRow();
    assert.equal(row.title, "X");
    assert.equal(row.body, null);
    assert.equal(row.principalTitle, null);
    assert.equal(row.registrarTitle, null);

    const all = await getDocumentTemplateWording();
    assert.equal(all[TEMPLATE].title, "X");
    assert.equal(all[TEMPLATE].body, defaults.body);
    assert.equal(all[TEMPLATE].principalTitle, defaults.principalTitle);
    assert.deepEqual(Object.keys(all).sort(), Object.keys(DEFAULT_WORDING).sort());
    assert.deepEqual(all["enrolment-jhs"], DEFAULT_WORDING["enrolment-jhs"]);
  });

  it("round-trips a blank registrar title", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    assert.notEqual(defaults.registrarTitle, "");
    await saveDocumentTemplateWording({
      template: TEMPLATE,
      title: defaults.title,
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: "",
    });
    assert.equal((await readRow()).registrarTitle, "");
    const all = await getDocumentTemplateWording();
    assert.equal(all[TEMPLATE].registrarTitle, "");
  });

  it("stores no override when a save matches the defaults", async () => {
    const defaults = DEFAULT_WORDING[ENROLMENT];
    assert.equal(defaults.registrarTitle, null);
    // A blank on a null-default field means "no opinion", so a save with the
    // exact effective values must write no override row at all.
    const saved = await saveDocumentTemplateWording({
      template: ENROLMENT,
      title: defaults.title,
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: "",
    });
    assert.deepEqual(saved, defaults);
    assert.equal(await readRow(ENROLMENT), undefined);
    assert.deepEqual((await getDocumentTemplateWording())[ENROLMENT], defaults);

    // The same save over an existing override removes it: the template must
    // print identically to a fresh install.
    await saveDocumentTemplateWording({
      template: ENROLMENT,
      title: "Custom",
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: "",
    });
    assert.ok(await readRow(ENROLMENT));
    await saveDocumentTemplateWording({
      template: ENROLMENT,
      title: defaults.title,
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: "",
    });
    assert.equal(await readRow(ENROLMENT), undefined);
    assert.deepEqual((await getDocumentTemplateWording())[ENROLMENT], defaults);
  });

  it("trims values before comparing and storing", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    await saveDocumentTemplateWording({
      template: TEMPLATE,
      title: `  ${defaults.title}  `,
      body: `\n${defaults.body}\n`,
      principalTitle: "  Head Teacher  ",
      registrarTitle: defaults.registrarTitle,
    });
    const row = await readRow();
    assert.equal(row.title, null);
    assert.equal(row.body, null);
    assert.equal(row.principalTitle, "Head Teacher");
  });

  it("rejects unknown and malformed placeholders without writing", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    for (const body of ["Hi {{name}} {{strand}}", "Hi {{name", "Hi name}}", "Hi {{ }} there", "Hi {{na me}}"]) {
      await assert.rejects(
        saveDocumentTemplateWording({
          template: TEMPLATE,
          title: defaults.title,
          body,
          principalTitle: defaults.principalTitle,
          registrarTitle: defaults.registrarTitle,
        }),
        (error: unknown) => error instanceof ZodError && /placeholder/.test(error.message),
        body,
      );
    }
    assert.equal(await readRow(), undefined);
  });

  it("rejects stray braces that are not part of a placeholder", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    for (const body of ["{{{name}}", "{{name}}}"]) {
      await assert.rejects(
        saveDocumentTemplateWording({
          template: TEMPLATE,
          title: defaults.title,
          body,
          principalTitle: defaults.principalTitle,
          registrarTitle: defaults.registrarTitle,
        }),
        (error: unknown) => error instanceof ZodError && /placeholder/.test(error.message),
        body,
      );
    }
    assert.equal(await readRow(), undefined);
  });

  it("accepts text with single braces", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const saved = await saveDocumentTemplateWording({
      template: TEMPLATE,
      title: defaults.title,
      body: "Grade {A} for {{name}}.",
      principalTitle: defaults.principalTitle,
      registrarTitle: defaults.registrarTitle,
    });
    assert.equal(saved.body, "Grade {A} for {{name}}.");
  });

  it("accepts every known placeholder, including spaced ones", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const saved = await saveDocumentTemplateWording({
      template: TEMPLATE,
      title: defaults.title,
      body: "{{name}} {{ grade }} {{schoolYear}} {{lrn}} {{purpose}} {{day}} {{month}}",
      principalTitle: defaults.principalTitle,
      registrarTitle: defaults.registrarTitle,
    });
    assert.equal(saved.body, "{{name}} {{ grade }} {{schoolYear}} {{lrn}} {{purpose}} {{day}} {{month}}");
  });

  it("rejects an unknown template, an empty body and over-long titles", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const valid = {
      template: TEMPLATE,
      title: defaults.title,
      body: defaults.body,
      principalTitle: defaults.principalTitle,
      registrarTitle: defaults.registrarTitle,
    };
    await assert.rejects(saveDocumentTemplateWording({ ...valid, template: "nope" }), ZodError);
    await assert.rejects(saveDocumentTemplateWording({ ...valid, body: "   " }), ZodError);
    await assert.rejects(saveDocumentTemplateWording({ ...valid, title: "a".repeat(201) }), ZodError);
    await assert.rejects(saveDocumentTemplateWording({ ...valid, principalTitle: "a".repeat(121) }), ZodError);
    await assert.rejects(saveDocumentTemplateWording({ ...valid, registrarTitle: "a".repeat(121) }), ZodError);
    await assert.rejects(resetDocumentTemplateWording("nope"), ZodError);
    assert.equal(await readRow(), undefined);
  });

  it("rejects bodies that overflow worst-case values without writing", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const body = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
    await assert.rejects(
      saveDocumentTemplateWording({
        template: TEMPLATE,
        title: defaults.title,
        body,
        principalTitle: defaults.principalTitle,
        registrarTitle: defaults.registrarTitle,
      }),
      TooLongBodyError,
    );
    assert.equal(await readRow(), undefined);
  });

  it("resets to defaults", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    await saveDocumentTemplateWording({
      template: TEMPLATE,
      title: "Custom",
      body: "Custom body for {{name}}.",
      principalTitle: "Head",
      registrarTitle: "",
    });
    assert.equal((await getDocumentTemplateWording())[TEMPLATE].title, "Custom");

    const reset = await resetDocumentTemplateWording(TEMPLATE);
    assert.deepEqual(reset, defaults);
    assert.deepEqual((await getDocumentTemplateWording())[TEMPLATE], defaults);
  });

  it("updates an existing row on a second save", async () => {
    const defaults = DEFAULT_WORDING[TEMPLATE];
    const base = { template: TEMPLATE, body: defaults.body, principalTitle: defaults.principalTitle, registrarTitle: defaults.registrarTitle };
    await saveDocumentTemplateWording({ ...base, title: "One" });
    await saveDocumentTemplateWording({ ...base, title: "Two" });
    assert.equal((await getDocumentTemplateWording())[TEMPLATE].title, "Two");
  });
});
