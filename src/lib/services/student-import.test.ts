import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as XLSX from "xlsx";
import type { AuditedActionInput } from "@/lib/services/audit-log";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-32b";

const { inArray } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { students, gradeLevels, sections, schoolYears } = await import("@/db/schema");
const {
  STUDENT_IMPORT_COLUMNS,
  StudentImportFileError,
  clean,
  commitStudentImport,
  mapStudentImportRow,
  parseStudentImportFile,
  validateStudentImportRows,
} = await import("@/lib/services/student-import");

const hasDb = Boolean(process.env.DATABASE_URL);

after(async () => {
  await closeDb();
});

// Parse a single date cell exactly the way production does
// (parseStudentImportFile: XLSX.read(buffer, { cellDates: true })).
function parseDateCell(value: number, format = "yyyy-mm-dd") {
  const worksheet = {
    "!ref": "A1:A2",
    A1: { v: "Birth Date (YYYY-MM-DD)", t: "s" as const },
    A2: { v: value, t: "n" as const, z: format },
  };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return parsed.Sheets.Students.A2.v as Date | string | number;
}

describe("clean", () => {
  it("keeps the Excel calendar date for a day-only date cell (regression: off-by-one day)", () => {
    // Serial 46037 = 2026-01-15. With xlsx 0.18.5 (local-midnight parsing)
    // this produced "2026-01-14" on Asia/Manila servers.
    assert.equal(clean(parseDateCell(46037)), "2026-01-15");
  });

  it("keeps the Excel calendar date for a date cell that carries a time", () => {
    // 46037.75 = 2026-01-15 18:00. The calendar date is still Jan 15 even
    // though a local-time reading in UTC+8 would land on Jan 16.
    assert.equal(clean(parseDateCell(46037.75, "yyyy-mm-dd hh:mm")), "2026-01-15");
  });

  it("returns an empty string for an Invalid Date", () => {
    assert.equal(clean(new Date(NaN)), "");
  });

  it("trims and stringifies non-Date values", () => {
    assert.equal(clean(" abc "), "abc");
    assert.equal(clean(undefined), "");
    assert.equal(clean(42), "42");
  });
});

describe("commitStudentImport audit (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("records exactly one batch audit entry naming the imported LRNs", async () => {
    const base = Date.now().toString().slice(-11);
    const lrns = [`${base}1`, `${base}2`];
    const rows = lrns.map((lrn) => ({
      lrn,
      firstName: "Audit",
      lastName: "Fixture",
      birthDate: "2010-01-01",
      studentType: "current",
      status: "enrolled",
      enrollmentStatus: "enrolled",
    }));

    const audits: AuditedActionInput[] = [];
    const db = getDb();

    try {
      const result = await commitStudentImport(
        { rows, fileName: "audit-fixture.xlsx" },
        {
          actor: { id: "test-actor", role: "admin" },
          recordAudit: async (input) => {
            audits.push(input);
            return { recordHash: "test-hash" };
          },
        },
      );

      assert.equal(result.importedCount, 2);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].referenceType, "student_import");
      assert.equal(audits[0].action, "Students imported");
      assert.equal(audits[0].entityType, "student");
      assert.equal(audits[0].actorRole, "admin");
      assert.equal(audits[0].actorUserId, "test-actor");
      assert.deepEqual(audits[0].metadata?.lrns, lrns);
      assert.equal(audits[0].metadata?.importedCount, 2);
      assert.equal(audits[0].metadata?.fileName, "audit-fixture.xlsx");
    } finally {
      await db.delete(students).where(inArray(students.lrn, lrns));
    }
  });
});

// ---------------------------------------------------------------------------
// Characterization coverage for the untested import surface: file parsing edge
// cases, pure row mapping, and DB-backed validation rules.
// ---------------------------------------------------------------------------

function csvField(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvContent(header: readonly string[], rows: unknown[][], eol = "\n") {
  return `${[header.map(csvField).join(","), ...rows.map((row) => row.map(csvField).join(","))].join(eol)}${eol}`;
}

function csvFile(content: string, name = "students.csv") {
  return new File([content], name);
}

// Build an XLSX buffer the same way production reads one
// (parseStudentImportFile: XLSX.read(buffer, { cellDates: true })). Numeric
// cells listed in dateCells are given a date format so they round-trip as Date.
function xlsxFile(aoa: unknown[][], dateCells: Record<string, string> = {}, name = "students.xlsx") {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  for (const [ref, format] of Object.entries(dateCells)) {
    const cell = worksheet[ref] as XLSX.CellObject;
    if (cell) {
      cell.z = format;
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  const buffer = new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);
  return new File([buffer], name);
}

let fixtureSeq = 0;

// Exactly 12 digits (the LRN shape the schema demands) and unique per process.
function fixtureLrn() {
  fixtureSeq += 1;
  return `${Date.now().toString().slice(-8)}${String(fixtureSeq).padStart(4, "0")}`;
}

function missingName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Raw header-style row, the shape parseStudentImportFile yields for the
// /api/students/import/validate intake.
function headerRow(lrn: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { LRN: lrn, "First Name": "Test", "Last Name": "Student", ...overrides };
}

// CamelCase row, the shape the uploader commits ({ rows: validation.validRows }).
function camelRow(lrn: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { lrn, firstName: "Test", lastName: "Student", ...overrides };
}

type AcademicFixtures = {
  gradeLevelName: string;
  otherGradeLevelName: string;
  schoolYearName: string;
  otherSchoolYearName: string;
  sectionName: string;
  otherGradeSectionName: string;
  otherYearSectionName: string;
};

// Creates uniquely named grade/section/school-year rows and ALWAYS deletes them
// again in finally, keyed to their generated ids — never touching real data.
async function withAcademicFixtures(run: (fixtures: AcademicFixtures) => Promise<void>) {
  const db = getDb();
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const fixtures: AcademicFixtures = {
    gradeLevelName: `TGL-${tag}`,
    otherGradeLevelName: `TGL2-${tag}`,
    schoolYearName: `TSY-${tag}`,
    otherSchoolYearName: `TSY2-${tag}`,
    sectionName: `TSEC-${tag}`,
    otherGradeSectionName: `TSEC-OG-${tag}`,
    otherYearSectionName: `TSEC-OY-${tag}`,
  };
  const createdGradeIds: string[] = [];
  const createdYearIds: string[] = [];
  const createdSectionIds: string[] = [];

  try {
    const [gradeLevel] = await db.insert(gradeLevels).values({ name: fixtures.gradeLevelName }).returning();
    const [otherGradeLevel] = await db.insert(gradeLevels).values({ name: fixtures.otherGradeLevelName }).returning();
    const [schoolYear] = await db.insert(schoolYears).values({ name: fixtures.schoolYearName }).returning();
    const [otherSchoolYear] = await db.insert(schoolYears).values({ name: fixtures.otherSchoolYearName }).returning();
    createdGradeIds.push(gradeLevel.id, otherGradeLevel.id);
    createdYearIds.push(schoolYear.id, otherSchoolYear.id);

    const createdSections = await db
      .insert(sections)
      .values([
        { name: fixtures.sectionName, gradeLevelId: gradeLevel.id, schoolYearId: schoolYear.id },
        { name: fixtures.otherGradeSectionName, gradeLevelId: otherGradeLevel.id, schoolYearId: schoolYear.id },
        { name: fixtures.otherYearSectionName, gradeLevelId: gradeLevel.id, schoolYearId: otherSchoolYear.id },
      ])
      .returning();
    createdSectionIds.push(...createdSections.map((row) => row.id));

    await run(fixtures);
  } finally {
    if (createdSectionIds.length > 0) {
      await db.delete(sections).where(inArray(sections.id, createdSectionIds));
    }
    if (createdGradeIds.length > 0) {
      await db.delete(gradeLevels).where(inArray(gradeLevels.id, createdGradeIds));
    }
    if (createdYearIds.length > 0) {
      await db.delete(schoolYears).where(inArray(schoolYears.id, createdYearIds));
    }
  }
}

describe("parseStudentImportFile", () => {
  it("rejects a file that is not a CSV, XLS, or XLSX", async () => {
    await assert.rejects(
      () => parseStudentImportFile(csvFile("LRN\n123\n", "students.txt")),
      (error: unknown) => {
        assert.ok(error instanceof StudentImportFileError);
        assert.equal(error.message, "Upload a CSV, XLS, or XLSX file.");
        return true;
      },
    );
  });

  it("rejects an empty file", async () => {
    await assert.rejects(
      () => parseStudentImportFile(csvFile("")),
      (error: unknown) => {
        assert.ok(error instanceof StudentImportFileError);
        assert.equal(error.message, "The selected file is empty.");
        return true;
      },
    );
  });

  it("rejects a file larger than 5 MB", async () => {
    await assert.rejects(
      () => parseStudentImportFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.csv")),
      (error: unknown) => {
        assert.ok(error instanceof StudentImportFileError);
        assert.equal(error.message, "Student import files must be 5 MB or smaller.");
        return true;
      },
    );
  });

  it("accepts uppercase file extensions", async () => {
    const rows = await parseStudentImportFile(csvFile(csvContent(["LRN"], [["123456789012"]]), "students.CSV"));
    assert.equal(rows.length, 1);
  });

  it("strips a UTF-8 BOM so the first column is still read", async () => {
    const content = `\uFEFF${csvContent(["LRN", "First Name", "Last Name"], [["123456789012", "Juan", "Cruz"]])}`;
    const rows = await parseStudentImportFile(csvFile(content));

    assert.equal(rows.length, 1);
    assert.equal(Object.keys(rows[0])[0], "LRN");
    assert.equal(rows[0]["LRN"], "123456789012");
    assert.equal(mapStudentImportRow(rows[0]).lrn, "123456789012");
  });

  it("parses CRLF line endings into the same rows as LF", async () => {
    const content = csvContent(["LRN", "First Name", "Last Name"], [["123456789012", "Juan", "Cruz"], ["123456789013", "Ana", "Reyes"]], "\r\n");
    const rows = await parseStudentImportFile(csvFile(content));

    assert.equal(rows.length, 2);
    assert.equal(rows[0]["First Name"], "Juan");
    assert.equal(rows[1]["Last Name"], "Reyes");
  });

  it("preserves quoted fields containing commas and escaped quotes", async () => {
    const content = csvContent(
      ["LRN", "Last Name", "Address"],
      [["123456789012", 'Dela Cruz, Jr.', '123 Rizal St, Brgy. Uno']],
    );
    const rows = await parseStudentImportFile(csvFile(content));

    assert.equal(rows.length, 1);
    assert.equal(rows[0]["Last Name"], "Dela Cruz, Jr.");
    assert.equal(rows[0]["Address"], "123 Rizal St, Brgy. Uno");

    const quotedQuote = csvContent(["LRN", "Last Name"], [["123456789012", 'Juan "The Boss" Cruz']]);
    const quotedRows = await parseStudentImportFile(csvFile(quotedQuote));
    assert.equal(quotedRows[0]["Last Name"], 'Juan "The Boss" Cruz');
  });

  it("reads every STUDENT_IMPORT_COLUMNS header, including parenthetical suffixes", async () => {
    const values = [
      "123456789012", "Maria", "Santos", "Dela Cruz", "Jr.", "2010-05-06",
      "Female", "maria@example.com", "09171234567", "123 Rizal St",
      "Jose Dela Cruz", "09181234567", "Grade 7", "Sampaguita", "2026-2027",
      "current", "enrolled", "enrolled",
    ];
    const rows = await parseStudentImportFile(csvFile(csvContent(STUDENT_IMPORT_COLUMNS, [values])));

    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]), [...STUDENT_IMPORT_COLUMNS]);
    assert.equal(rows[0]["Birth Date (YYYY-MM-DD)"], "2010-05-06");
    assert.equal(mapStudentImportRow(rows[0]).birthDate, "2010-05-06");
  });

  it("keeps unknown columns in the raw row without breaking the known ones", async () => {
    const content = csvContent(
      ["LRN", "First Name", "Last Name", "Notes", "Advisor Name"],
      [["123456789012", "Juan", "Cruz", "transfer case", "Mrs. Reyes"]],
    );
    const rows = await parseStudentImportFile(csvFile(content));

    assert.equal(rows.length, 1);
    assert.equal(rows[0]["Notes"], "transfer case");
    assert.equal(mapStudentImportRow(rows[0]).firstName, "Juan");
  });

  it("returns no rows for a CSV with headers but no data rows", async () => {
    const rows = await parseStudentImportFile(csvFile(csvContent(["LRN", "First Name", "Last Name"], [])));
    assert.deepEqual(rows, []);
  });

  it("accepts exactly 500 data rows", async () => {
    const header = ["LRN", "First Name", "Last Name"];
    const rows500 = Array.from({ length: 500 }, (_, index) => [String(100000000000 + index), `First${index}`, `Last${index}`]);
    const rows = await parseStudentImportFile(csvFile(csvContent(header, rows500)));
    assert.equal(rows.length, 500);
  });

  it("rejects more than 500 data rows", async () => {
    const header = ["LRN", "First Name", "Last Name"];
    const rows501 = Array.from({ length: 501 }, (_, index) => [String(100000000000 + index), `First${index}`, `Last${index}`]);

    await assert.rejects(
      () => parseStudentImportFile(csvFile(csvContent(header, rows501))),
      (error: unknown) => {
        assert.ok(error instanceof StudentImportFileError);
        assert.equal(error.message, "Import up to 500 students at a time.");
        return true;
      },
    );
  });

  it("reads an XLSX sheet and keeps the Excel calendar date for date-formatted cells", async () => {
    const values = [
      "123456789012", "Ana", "", "Reyes", "", 46037,
      "Female", "", "", "", "", "",
      "", "", "", "current", "enrolled", "enrolled",
    ];
    const valuesWithTime = [...values];
    valuesWithTime[0] = "123456789013";
    valuesWithTime[5] = 46037.75;
    // Serial 46037 = 2026-01-15; 46037.75 adds 18:00 without moving the date.
    const file = xlsxFile(
      [[...STUDENT_IMPORT_COLUMNS], values, valuesWithTime],
      { F2: "yyyy-mm-dd", F3: "yyyy-mm-dd hh:mm" },
    );
    const rows = await parseStudentImportFile(file);

    assert.equal(rows.length, 2);
    // Regression: sheet_to_json used to shift date cells into server-local
    // time, so the parse path saw 2026-01-14 for serial 46037 in UTC+8.
    // The exact instants are pinned as well: pre-fix utc_to_local breaks them
    // in EVERY non-UTC timezone, whereas the clean() output alone only fails
    // in timezones ahead of UTC (in UTC-5 the shifted instant still slices to
    // "2026-01-15").
    // Note: no output-level assertion can detect a revert at exactly TZ=UTC,
    // where utc_to_local is the identity — the run matrix must include at
    // least one non-UTC timezone for this pin to have teeth.
    const dayOnlyCell = rows[0]["Birth Date (YYYY-MM-DD)"] as Date;
    const withTimeCell = rows[1]["Birth Date (YYYY-MM-DD)"] as Date;
    assert.ok(dayOnlyCell instanceof Date);
    assert.equal(dayOnlyCell.toISOString(), "2026-01-15T00:00:00.000Z");
    assert.equal(withTimeCell.toISOString(), "2026-01-15T18:00:00.000Z");
    assert.equal(clean(dayOnlyCell), "2026-01-15");
    assert.equal(clean(withTimeCell), "2026-01-15");
    assert.equal(mapStudentImportRow(rows[0]).birthDate, "2026-01-15");
  });
});

describe("mapStudentImportRow", () => {
  const expected = {
    lrn: "123456789012",
    firstName: "Maria",
    middleName: "Santos",
    lastName: "Dela Cruz",
    suffix: "Jr.",
    birthDate: "2010-05-06",
    gender: "Female",
    email: "maria@example.com",
    contactNumber: "09171234567",
    address: "123 Rizal St, Brgy. Uno",
    guardianName: "Jose Dela Cruz",
    guardianContact: "09181234567",
    gradeLevel: "Grade 7",
    section: "Sampaguita",
    schoolYear: "2026-2027",
    studentType: "current",
    status: "enrolled",
    enrollmentStatus: "enrolled",
  };

  it("maps every STUDENT_IMPORT_COLUMNS label, including parenthetical suffixes, to its field", () => {
    const displayRow = {
      LRN: "123456789012",
      "First Name": "Maria",
      "Middle Name": "Santos",
      "Last Name": "Dela Cruz",
      Suffix: "Jr.",
      "Birth Date (YYYY-MM-DD)": "2010-05-06",
      Gender: "Female",
      Email: "maria@example.com",
      "Contact Number": "09171234567",
      Address: "123 Rizal St, Brgy. Uno",
      "Guardian Name": "Jose Dela Cruz",
      "Guardian Contact": "09181234567",
      "Grade Level": "Grade 7",
      Section: "Sampaguita",
      "School Year": "2026-2027",
      "Student Type": "current",
      Status: "enrolled",
      "Enrollment Status": "enrolled",
    };

    assert.deepEqual(mapStudentImportRow(displayRow), expected);
  });

  it("maps the camelCase commit-payload keys to the same fields as the display labels", () => {
    const commitRow = {
      lrn: "123456789012",
      firstName: "Maria",
      middleName: "Santos",
      lastName: "Dela Cruz",
      suffix: "Jr.",
      birthDate: "2010-05-06",
      gender: "Female",
      email: "maria@example.com",
      contactNumber: "09171234567",
      address: "123 Rizal St, Brgy. Uno",
      guardianName: "Jose Dela Cruz",
      guardianContact: "09181234567",
      gradeLevel: "Grade 7",
      section: "Sampaguita",
      schoolYear: "2026-2027",
      studentType: "current",
      status: "enrolled",
      enrollmentStatus: "enrolled",
    };

    assert.deepEqual(mapStudentImportRow(commitRow), expected);
  });

  it("ignores unknown columns", () => {
    const row = {
      LRN: "123456789012",
      "First Name": "Maria",
      "Last Name": "Dela Cruz",
      Notes: "transfer case",
      "Advisor Name": "Mrs. Reyes",
      studentType: "current",
      status: "enrolled",
      enrollmentStatus: "enrolled",
    };

    const mapped = mapStudentImportRow(row) as Record<string, unknown>;
    assert.equal("Notes" in mapped, false);
    assert.equal("Advisor Name" in mapped, false);
    assert.deepEqual(Object.keys(mapped).sort(), [
      "address", "birthDate", "contactNumber", "email", "enrollmentStatus", "firstName",
      "gender", "gradeLevel", "guardianContact", "guardianName", "lastName", "lrn",
      "middleName", "schoolYear", "section", "status", "studentType", "suffix",
    ]);
  });

  it("accepts common header spellings such as birth_date and FIRST NAME", () => {
    const mapped = mapStudentImportRow({
      lrn: "123456789012",
      FIRST_NAME: "Maria",
      "LAST NAME": "Dela Cruz",
      birth_date: "2010-05-06",
    });

    assert.equal(mapped.lrn, "123456789012");
    assert.equal(mapped.firstName, "Maria");
    assert.equal(mapped.lastName, "Dela Cruz");
    assert.equal(mapped.birthDate, "2010-05-06");
  });

  it("defaults status, enrollment status, and student type to enrolled/current when blank", () => {
    const mapped = mapStudentImportRow(headerRow("123456789012"));

    assert.equal(mapped.status, "enrolled");
    assert.equal(mapped.enrollmentStatus, "enrolled");
    assert.equal(mapped.studentType, "current");
  });

  it("derives student type and enrollment status from Status when those columns are blank", () => {
    const alumni = mapStudentImportRow(headerRow("123456789012", { Status: "alumni" }));
    assert.equal(alumni.studentType, "alumni");
    assert.equal(alumni.enrollmentStatus, "alumni");
    assert.equal(alumni.status, "alumni");

    const transferred = mapStudentImportRow(headerRow("123456789012", { Status: "transferred" }));
    assert.equal(transferred.studentType, "transferee");
  });

  it("falls back to Enrollment Status when Status is blank", () => {
    const mapped = mapStudentImportRow(headerRow("123456789012", { "Enrollment Status": "alumni" }));

    assert.equal(mapped.status, "alumni");
    assert.equal(mapped.enrollmentStatus, "alumni");
    assert.equal(mapped.studentType, "alumni");
  });

  it("keeps an explicit Student Type over the status-derived default", () => {
    const mapped = mapStudentImportRow(headerRow("123456789012", { Status: "enrolled", "Student Type": "transferee" }));
    assert.equal(mapped.studentType, "transferee");
    assert.equal(mapped.status, "enrolled");
  });
});

describe("validateStudentImportRows with no rows", () => {
  it("reports a file-level error when the row set is empty", async () => {
    const result = await validateStudentImportRows([]);

    assert.deepEqual(result, {
      totalRows: 0,
      validRows: [],
      errors: [{ rowNumber: 1, fieldName: "File", message: "The spreadsheet has no student rows." }],
    });
  });
});

describe("validateStudentImportRows (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  it("returns zero errors for a fully valid row set and resolves grade, section, and school year", async () => {
    await withAcademicFixtures(async (fx) => {
      const rows = [
        headerRow(fixtureLrn(), {
          "Birth Date (YYYY-MM-DD)": "2010-05-06",
          "Grade Level": fx.gradeLevelName,
          Section: fx.sectionName,
          "School Year": fx.schoolYearName,
        }),
      ];

      const result = await validateStudentImportRows(rows);

      assert.deepEqual(result.errors, []);
      assert.equal(result.totalRows, 1);
      assert.equal(result.validRows.length, 1);
      assert.equal(result.validRows[0].birthDate, "2010-05-06");
      assert.equal(result.validRows[0].gradeLevel, fx.gradeLevelName);
      assert.equal(result.validRows[0].section, fx.sectionName);
      assert.equal(result.validRows[0].schoolYear, fx.schoolYearName);
    });
  });

  it("returns zero errors for the camelCase rows the commit endpoint receives", async () => {
    await withAcademicFixtures(async (fx) => {
      const rows = [
        camelRow(fixtureLrn(), {
          birthDate: "2010-01-01",
          gradeLevel: fx.gradeLevelName,
          section: fx.sectionName,
          schoolYear: fx.schoolYearName,
          studentType: "current",
          status: "enrolled",
          enrollmentStatus: "enrolled",
        }),
      ];

      const result = await validateStudentImportRows(rows);

      assert.deepEqual(result.errors, []);
      assert.equal(result.validRows.length, 1);
      assert.equal(result.validRows[0].birthDate, "2010-01-01");
    });
  });

  it("keeps the first occurrence valid and flags only later duplicates of an in-file LRN (pinned)", async () => {
    const lrn = fixtureLrn();
    const rows = [
      headerRow(lrn, { "First Name": "Alpha" }),
      headerRow(lrn, { "First Name": "Beta" }),
    ];

    const result = await validateStudentImportRows(rows);

    // Pinned: only the repeat is flagged; the first occurrence stays "ready to
    // import". Harmless in the real flow because the uploader refuses to commit
    // while any error remains (all-or-nothing batch).
    assert.deepEqual(result.errors, [
      { rowNumber: 3, fieldName: "LRN", message: "This LRN appears more than once in the file." },
    ]);
    assert.equal(result.totalRows, 2);
    assert.equal(result.validRows.length, 1);
    assert.equal(result.validRows[0].firstName, "Alpha");
  });

  it("flags an LRN that already belongs to a student record", async () => {
    const lrn = fixtureLrn();
    const db = getDb();
    const [created] = await db.insert(students).values({ lrn, firstName: "Existing", lastName: "Fixture" }).returning();

    try {
      const result = await validateStudentImportRows([headerRow(lrn)]);

      assert.deepEqual(result.errors, [
        { rowNumber: 2, fieldName: "LRN", message: "This LRN already belongs to a student record." },
      ]);
      assert.equal(result.validRows.length, 0);
    } finally {
      await db.delete(students).where(inArray(students.id, [created.id]));
    }
  });

  it("flags a grade level name that does not exist", async () => {
    const rows = [headerRow(fixtureLrn(), { "Grade Level": missingName("No Such Grade") })];

    const result = await validateStudentImportRows(rows);

    assert.deepEqual(result.errors, [
      { rowNumber: 2, fieldName: "Grade level", message: "This grade level does not exist." },
    ]);
    assert.equal(result.validRows.length, 0);
  });

  it("flags a school year name that does not exist", async () => {
    const rows = [headerRow(fixtureLrn(), { "School Year": missingName("No Such Year") })];

    const result = await validateStudentImportRows(rows);

    assert.deepEqual(result.errors, [
      { rowNumber: 2, fieldName: "School year", message: "This school year does not exist." },
    ]);
    assert.equal(result.validRows.length, 0);
  });

  it("flags a section when no grade level is chosen", async () => {
    await withAcademicFixtures(async (fx) => {
      const rows = [headerRow(fixtureLrn(), { Section: fx.sectionName })];

      const result = await validateStudentImportRows(rows);

      assert.deepEqual(result.errors, [
        { rowNumber: 2, fieldName: "Section", message: "Choose a grade level before assigning a section." },
      ]);
    });
  });

  it("flags a section name that does not exist for the selected grade and school year", async () => {
    await withAcademicFixtures(async (fx) => {
      const rows = [
        headerRow(fixtureLrn(), {
          "Grade Level": fx.gradeLevelName,
          Section: missingName("No Such Section"),
          "School Year": fx.schoolYearName,
        }),
      ];

      const result = await validateStudentImportRows(rows);

      assert.deepEqual(result.errors, [
        { rowNumber: 2, fieldName: "Section", message: "This section does not exist for the selected grade and school year." },
      ]);
    });
  });

  it("flags a section that belongs to a different grade level", async () => {
    await withAcademicFixtures(async (fx) => {
      const rows = [
        headerRow(fixtureLrn(), {
          "Grade Level": fx.gradeLevelName,
          Section: fx.otherGradeSectionName,
          "School Year": fx.schoolYearName,
        }),
      ];

      const result = await validateStudentImportRows(rows);

      assert.deepEqual(result.errors, [
        { rowNumber: 2, fieldName: "Section", message: "This section does not exist for the selected grade and school year." },
      ]);
    });
  });

  it("flags a section that belongs to a different school year", async () => {
    await withAcademicFixtures(async (fx) => {
      const rows = [
        headerRow(fixtureLrn(), {
          "Grade Level": fx.gradeLevelName,
          Section: fx.sectionName,
          "School Year": fx.otherSchoolYearName,
        }),
      ];

      const result = await validateStudentImportRows(rows);

      assert.deepEqual(result.errors, [
        { rowNumber: 2, fieldName: "Section", message: "This section does not exist for the selected grade and school year." },
      ]);
    });
  });

  it("aggregates errors from multiple bad rows with their spreadsheet row numbers", async () => {
    const rows = [
      headerRow("123", { "First Name": "BadLrn" }),
      headerRow(fixtureLrn(), { "First Name": "BadGrade", "Grade Level": missingName("No Such Grade") }),
      headerRow(fixtureLrn(), { "First Name": "BadContact", Email: "not-an-email", "Birth Date (YYYY-MM-DD)": "05/06/2010" }),
      headerRow(fixtureLrn(), { "First Name": "Valid" }),
    ];

    const result = await validateStudentImportRows(rows);

    const byRowAndField = (a: { rowNumber: number; fieldName: string }, b: { rowNumber: number; fieldName: string }) =>
      a.rowNumber - b.rowNumber || a.fieldName.localeCompare(b.fieldName);
    // Sorted before comparing: the order of multiple zod issues within one row
    // is not part of the behavior worth pinning.
    assert.deepEqual([...result.errors].sort(byRowAndField), [
      { rowNumber: 2, fieldName: "LRN", message: "LRN must contain exactly 12 digits." },
      { rowNumber: 3, fieldName: "Grade level", message: "This grade level does not exist." },
      { rowNumber: 4, fieldName: "Birth date", message: "Birth date must use YYYY-MM-DD." },
      { rowNumber: 4, fieldName: "Email", message: "Enter a valid email address." },
    ]);
    assert.equal(result.totalRows, 4);
    assert.equal(result.validRows.length, 1);
    assert.equal(result.validRows[0].firstName, "Valid");
  });

  it("accepts capitalized Status but rejects capitalized Student Type (pinned: enum columns are case-sensitive)", async () => {
    const rows = [headerRow(fixtureLrn(), { Status: "Enrolled", "Student Type": "Current" })];

    const result = await validateStudentImportRows(rows);

    // Pinned: Status is lowercased before validation but Student Type is not,
    // so "Current" is rejected while "Enrolled" is accepted. Surprising but
    // visible to the user as an explicit, fixable error — see task-3-report.md.
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].rowNumber, 2);
    assert.equal(result.errors[0].fieldName, "Student type");
    assert.match(result.errors[0].message, /expected/i);
    assert.equal(result.validRows.length, 0);
  });

  it("shows the schema field name when there is no display label (pinned: e.g. middleName)", async () => {
    const rows = [headerRow(fixtureLrn(), { "Middle Name": "M".repeat(101) })];

    const result = await validateStudentImportRows(rows);

    // Pinned: fields without a friendly label surface as camelCase schema keys
    // in the error table. Attribution is correct, only the label is raw.
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].rowNumber, 2);
    assert.equal(result.errors[0].fieldName, "middleName");
    assert.match(result.errors[0].message, /too big/i);
  });

  it("numbers errors by data-record position, skipping blank lines (pinned limitation: not physical file lines)", async () => {
    const grade = missingName("No Such Grade");
    const content = csvContent(
      ["LRN", "First Name", "Last Name", "Grade Level"],
      [
        [fixtureLrn(), "Line2", "One", grade],
        [], // blank physical line 3
        [fixtureLrn(), "Line4", "Two", grade],
      ],
      "\r\n",
    );
    const rows = await parseStudentImportFile(csvFile(content));
    assert.equal(rows.length, 2);

    const result = await validateStudentImportRows(rows);

    // Pinned limitation: row numbers count data records, so the error for the
    // row that physically sits on file line 4 is reported as row 3.
    assert.deepEqual(result.errors.map((error) => error.rowNumber), [2, 3]);
  });
});
