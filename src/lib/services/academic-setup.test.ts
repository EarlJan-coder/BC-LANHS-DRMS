import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { eq, inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { certificates, documentRequests, documentTypes, gradeLevels, schoolYears, sections, students } = await import(
  "@/db/schema"
);
const { deleteDocumentType, deleteGradeLevel, deleteSchoolYear, deleteSection, isForeignKeyViolation } = await import(
  "@/lib/services/academic-setup"
);

const hasDb = Boolean(process.env.DATABASE_URL);
// Run-unique fixture tag: a crashed run can leak fixture rows, and fixed
// names would then deterministically block every later run (see sibling
// test files for the same convention).

test("isForeignKeyViolation detects Postgres 23503, including Drizzle's wrapped cause", () => {
  assert.equal(isForeignKeyViolation({ code: "23503" }), true);
  assert.equal(isForeignKeyViolation({ cause: { code: "23503" } }), true);
  assert.equal(isForeignKeyViolation({ cause: { cause: { code: "23503" } } }), true);
});

test("isForeignKeyViolation rejects other errors", () => {
  assert.equal(isForeignKeyViolation(new Error("boom")), false);
  assert.equal(isForeignKeyViolation({ code: "22P02" }), false);
  assert.equal(isForeignKeyViolation({ cause: { code: "22P02" } }), false);
  assert.equal(isForeignKeyViolation(null), false);
  assert.equal(isForeignKeyViolation(undefined), false);
});
const RUN_TAG = Date.now().toString(36).slice(-5);
let fixtureSeq = 0;
function fixtureName(local: string) {
  fixtureSeq += 1;
  return `${local}-${RUN_TAG}-${fixtureSeq}`;
}

type Cleanup = { table: typeof certificates | typeof documentRequests | typeof students | typeof sections | typeof gradeLevels | typeof schoolYears | typeof documentTypes; id: string };
const cleanup: Cleanup[] = [];

after(async () => {
  // FK-safe order: certificates -> document requests -> students -> sections
  // -> grade levels -> school years -> document types. Best effort with the
  // same tolerance as account-admin.test.ts: cleanup is not the behavior under
  // test and fixture names are run-unique.
  const order: Cleanup["table"][] = [certificates, documentRequests, students, sections, gradeLevels, schoolYears, documentTypes];
  const db = getDb();
  for (const table of order) {
    const ids = cleanup.filter((entry) => entry.table === table).map((entry) => entry.id);
    if (ids.length === 0) continue;
    try {
      await db.delete(table).where(inArray(table.id, ids));
    } catch (error) {
      console.warn(`academic-setup.test.ts: fixture cleanup failed for ${ids.join(", ")}:`, error);
    }
  }
  await closeDb();
});

function track<T extends { id: string }>(table: Cleanup["table"], row: T) {
  cleanup.push({ table, id: row.id });
  return row;
}

async function makeSchoolYear() {
  const db = getDb();
  const [row] = await db
    .insert(schoolYears)
    .values({ name: fixtureName("SY"), isActive: false })
    .returning();
  return track(schoolYears, row);
}

async function makeGradeLevel() {
  const db = getDb();
  const [row] = await db
    .insert(gradeLevels)
    .values({ name: fixtureName("GL"), order: 90 })
    .returning();
  return track(gradeLevels, row);
}

async function makeSection(gradeLevelId: string | null = null, schoolYearId: string | null = null) {
  const db = getDb();
  const [row] = await db
    .insert(sections)
    .values({ name: fixtureName("SEC"), gradeLevelId, schoolYearId })
    .returning();
  return track(sections, row);
}

async function makeStudent(links: { gradeLevelId?: string; sectionId?: string; schoolYearId?: string } = {}) {
  const db = getDb();
  const [row] = await db
    .insert(students)
    .values({
      lrn: fixtureName("LRN"),
      firstName: "Test",
      lastName: "Student",
      ...links,
    })
    .returning();
  return track(students, row);
}

async function makeCertificate(schoolYearId: string | null = null) {
  const db = getDb();
  const [row] = await db
    .insert(certificates)
    .values({
      certificateNumber: fixtureName("CERT"),
      certificateType: "Test certificate",
      verificationCode: fixtureName("VC"),
      qrCodeData: "test-qr",
      schoolYearId,
    })
    .returning();
  return track(certificates, row);
}

async function makeDocumentType() {
  const db = getDb();
  const [row] = await db
    .insert(documentTypes)
    .values({ name: fixtureName("DT"), code: fixtureName("DTC") })
    .returning();
  return track(documentTypes, row);
}

async function makeDocumentRequest(documentTypeId: string) {
  const db = getDb();
  const [row] = await db
    .insert(documentRequests)
    .values({ trackingNumber: fixtureName("TRK"), purpose: "Test purpose", documentTypeId })
    .returning();
  return track(documentRequests, row);
}

async function countRows(table: Cleanup["table"], id: string) {
  const db = getDb();
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.id, id));
  return rows.length;
}

describe("academic setup deletes (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  test("deleteSchoolYear removes an unused school year", async () => {
    const year = await makeSchoolYear();

    const deleted = await deleteSchoolYear(year.id);

    assert.equal(deleted.id, year.id);
    assert.equal(await countRows(schoolYears, year.id), 0);
  });

  test("deleteSchoolYear refuses when sections, students, and certificates reference it", async () => {
    const year = await makeSchoolYear();
    await makeSection(null, year.id);
    await makeStudent({ schoolYearId: year.id });
    await makeCertificate(year.id);

    await assert.rejects(
      () => deleteSchoolYear(year.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { status?: number }).status, 409);
        assert.equal(
          error.message,
          "This school year has 1 section, 1 student, and 1 certificate linked to it. Close it instead.",
        );
        return true;
      },
    );

    assert.equal(await countRows(schoolYears, year.id), 1);
  });

  test("deleteSchoolYear refuses with plural counts", async () => {
    const year = await makeSchoolYear();
    await makeStudent({ schoolYearId: year.id });
    await makeStudent({ schoolYearId: year.id });

    await assert.rejects(
      () => deleteSchoolYear(year.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { status?: number }).status, 409);
        assert.equal(error.message, "This school year has 2 students linked to it. Close it instead.");
        return true;
      },
    );
  });

  test("deleteSchoolYear throws 404 for a missing id", async () => {
    await assert.rejects(
      () => deleteSchoolYear("00000000-0000-4000-8000-000000000000"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { status?: number }).status, 404);
        assert.equal(error.message, "School year not found.");
        return true;
      },
    );
  });

  test("deleteGradeLevel removes an unused grade level", async () => {
    const gradeLevel = await makeGradeLevel();

    const deleted = await deleteGradeLevel(gradeLevel.id);

    assert.equal(deleted.id, gradeLevel.id);
    assert.equal(await countRows(gradeLevels, gradeLevel.id), 0);
  });

  test("deleteGradeLevel refuses when a section references it", async () => {
    const gradeLevel = await makeGradeLevel();
    await makeSection(gradeLevel.id);

    await assert.rejects(
      () => deleteGradeLevel(gradeLevel.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { status?: number }).status, 409);
        assert.equal(
          error.message,
          "This grade level has 1 section linked to it. Deactivate it instead.",
        );
        return true;
      },
    );

    assert.equal(await countRows(gradeLevels, gradeLevel.id), 1);
  });

  test("deleteSection removes an unused section", async () => {
    const section = await makeSection();

    const deleted = await deleteSection(section.id);

    assert.equal(deleted.id, section.id);
    assert.equal(await countRows(sections, section.id), 0);
  });

  test("deleteSection refuses when a student references it", async () => {
    const section = await makeSection();
    await makeStudent({ sectionId: section.id });

    await assert.rejects(
      () => deleteSection(section.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { status?: number }).status, 409);
        assert.equal(
          error.message,
          "This section has 1 student linked to it. Deactivate it instead.",
        );
        return true;
      },
    );

    assert.equal(await countRows(sections, section.id), 1);
  });

  test("deleteDocumentType removes an unused document type", async () => {
    const documentType = await makeDocumentType();

    const deleted = await deleteDocumentType(documentType.id);

    assert.equal(deleted.id, documentType.id);
    assert.equal(await countRows(documentTypes, documentType.id), 0);
  });

  test("deleteDocumentType refuses when a document request references it", async () => {
    const documentType = await makeDocumentType();
    await makeDocumentRequest(documentType.id);

    await assert.rejects(
      () => deleteDocumentType(documentType.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { status?: number }).status, 409);
        assert.equal(
          error.message,
          "This document type has 1 document request linked to it. Deactivate it instead.",
        );
        return true;
      },
    );

    assert.equal(await countRows(documentTypes, documentType.id), 1);
  });
});
