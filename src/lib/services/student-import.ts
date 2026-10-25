import { parse } from "csv-parse/sync";
import { inArray, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getDb } from "@/db";
import { gradeLevels, schoolYears, sections, students, type UserRole } from "@/db/schema";
import { generatePrefixedId } from "@/lib/utils";
import { recordAuditedAction, type AuditedActionInput } from "./audit-log";

export const STUDENT_IMPORT_COLUMNS = [
  "LRN",
  "First Name",
  "Middle Name",
  "Last Name",
  "Suffix",
  "Birth Date (YYYY-MM-DD)",
  "Gender",
  "Email",
  "Contact Number",
  "Address",
  "Guardian Name",
  "Guardian Contact",
  "Grade Level",
  "Section",
  "School Year",
  "Student Type",
  "Status",
  "Enrollment Status",
] as const;

const MAX_STUDENT_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_STUDENT_IMPORT_ROWS = 500;
const STUDENT_TYPES = ["current", "alumni", "transferee"] as const;
const STUDENT_STATUSES = ["enrolled", "alumni", "transferred", "inactive"] as const;

const optionalText = (max: number) => z.string().trim().max(max).default("");

const studentImportRowSchema = z.object({
  lrn: z.string().trim().regex(/^\d{12}$/, "LRN must contain exactly 12 digits."),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  middleName: optionalText(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  suffix: optionalText(20),
  birthDate: z.string().refine(isIsoDateOrEmpty, "Birth date must use YYYY-MM-DD."),
  gender: optionalText(30),
  email: z.string().trim().max(191).refine((value) => !value || z.string().email().safeParse(value).success, "Enter a valid email address."),
  contactNumber: optionalText(30),
  address: optionalText(2000),
  guardianName: optionalText(150),
  guardianContact: optionalText(30),
  gradeLevel: optionalText(80),
  section: optionalText(80),
  schoolYear: optionalText(30),
  studentType: z.enum(STUDENT_TYPES),
  status: z.enum(STUDENT_STATUSES),
  enrollmentStatus: z.enum(STUDENT_STATUSES),
});

const commitSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "The import contains no student rows.").max(MAX_STUDENT_IMPORT_ROWS),
  fileName: z.string().trim().max(255).optional(),
});

export type StudentImportRow = z.infer<typeof studentImportRowSchema>;

export type StudentImportError = {
  rowNumber: number;
  fieldName: string;
  message: string;
};

export type StudentImportValidation = {
  totalRows: number;
  validRows: StudentImportRow[];
  errors: StudentImportError[];
};

export class StudentImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentImportFileError";
  }
}

export class StudentImportValidationError extends Error {
  constructor(public validation: StudentImportValidation) {
    super("Fix the spreadsheet errors before importing students.");
    this.name = "StudentImportValidationError";
  }
}

export class StudentImportConflictError extends Error {
  constructor(public validation: StudentImportValidation) {
    super("Student records changed after validation. Review the new errors and upload again.");
    this.name = "StudentImportConflictError";
  }
}

type RawRow = Record<string, unknown>;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]/g, "");
}

function readColumn(row: RawRow, label: (typeof STUDENT_IMPORT_COLUMNS)[number]) {
  const key = normalizeHeader(label);
  const entry = Object.entries(row).find(([header]) => normalizeHeader(header) === key);
  return entry?.[1] ?? "";
}

export function clean(value: unknown) {
  if (value instanceof Date) {
    // xlsx >= 0.20 parses date cells with UTC interpretation, so the Excel
    // calendar date is carried in the UTC components. Read it from there —
    // local-time extraction would shift date cells that carry a time
    // (e.g. serial 46037.75 -> Jan 16 in UTC+8) and is server-TZ dependent.
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }

  return String(value ?? "").trim();
}

function isIsoDateOrEmpty(value: string) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Pure row mapping, shared by validation and commit. Exported for
// characterization tests: both the raw header-style rows produced by
// parseStudentImportFile and the uploader's camelCase commit payload map
// through the same normalizeHeader-based column lookup.
export function mapStudentImportRow(row: RawRow) {
  const status = clean(readColumn(row, "Status")).toLowerCase() ||
    clean(readColumn(row, "Enrollment Status")).toLowerCase() || "enrolled";
  const enrollmentStatus = clean(readColumn(row, "Enrollment Status")).toLowerCase() || status;

  return {
    lrn: clean(readColumn(row, "LRN")),
    firstName: clean(readColumn(row, "First Name")),
    middleName: clean(readColumn(row, "Middle Name")),
    lastName: clean(readColumn(row, "Last Name")),
    suffix: clean(readColumn(row, "Suffix")),
    birthDate: clean(readColumn(row, "Birth Date (YYYY-MM-DD)")),
    gender: clean(readColumn(row, "Gender")),
    email: clean(readColumn(row, "Email")),
    contactNumber: clean(readColumn(row, "Contact Number")),
    address: clean(readColumn(row, "Address")),
    guardianName: clean(readColumn(row, "Guardian Name")),
    guardianContact: clean(readColumn(row, "Guardian Contact")),
    gradeLevel: clean(readColumn(row, "Grade Level")),
    section: clean(readColumn(row, "Section")),
    schoolYear: clean(readColumn(row, "School Year")),
    studentType: clean(readColumn(row, "Student Type")) ||
      (status === "alumni" ? "alumni" : status === "transferred" ? "transferee" : "current"),
    status,
    enrollmentStatus,
  };
}

export function studentImportTemplateXlsx() {
  const worksheet = XLSX.utils.aoa_to_sheet([[...STUDENT_IMPORT_COLUMNS]]);
  worksheet["!cols"] = STUDENT_IMPORT_COLUMNS.map((column) => ({ wch: Math.min(28, Math.max(16, column.length + 3)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function parseStudentImportFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["csv", "xls", "xlsx"].includes(extension)) {
    throw new StudentImportFileError("Upload a CSV, XLS, or XLSX file.");
  }

  if (file.size === 0) {
    throw new StudentImportFileError("The selected file is empty.");
  }

  if (file.size > MAX_STUDENT_IMPORT_BYTES) {
    throw new StudentImportFileError("Student import files must be 5 MB or smaller.");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: RawRow[];

    if (extension === "csv") {
      rows = parse(buffer.toString("utf8"), {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 20_000,
      }) as RawRow[];
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      // BUG FIX (task 3): sheet_to_json rewrote date cells into server-local
      // time by default (utc_to_local), so clean() — which reads the UTC
      // components xlsx produced at read time — saw the previous day for every
      // XLSX date cell in timezones ahead of UTC (e.g. UTC+8 shifted all birth
      // dates back one day). UTC: true keeps the read-time Dates whose UTC
      // components carry the Excel calendar date.
      rows = worksheet ? XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: "", UTC: true }) : [];
    }

    if (rows.length > MAX_STUDENT_IMPORT_ROWS) {
      throw new StudentImportFileError(`Import up to ${MAX_STUDENT_IMPORT_ROWS} students at a time.`);
    }

    return rows;
  } catch (error) {
    if (error instanceof StudentImportFileError) {
      throw error;
    }

    throw new StudentImportFileError("Unable to read this file. Check that it is a valid CSV or Excel spreadsheet.");
  }
}

export async function validateStudentImportRows(rows: RawRow[]): Promise<StudentImportValidation> {
  const errors: StudentImportError[] = [];
  const candidates = rows.map((row, index) => ({ rowNumber: index + 2, values: mapStudentImportRow(row) }));

  if (rows.length === 0) {
    return {
      totalRows: 0,
      validRows: [],
      errors: [{ rowNumber: 1, fieldName: "File", message: "The spreadsheet has no student rows." }],
    };
  }

  const lrns = [...new Set(candidates.map(({ values }) => values.lrn).filter(Boolean))];
  const db = getDb();
  const [existingStudents, gradeLevelRows, sectionRows, schoolYearRows] = await Promise.all([
    lrns.length > 0
      ? db.select({ lrn: students.lrn }).from(students).where(inArray(students.lrn, lrns))
      : Promise.resolve([]),
    db.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels),
    db.select({ id: sections.id, name: sections.name, gradeLevelId: sections.gradeLevelId, schoolYearId: sections.schoolYearId }).from(sections),
    db.select({ id: schoolYears.id, name: schoolYears.name }).from(schoolYears),
  ]);

  const existingLrns = new Set(existingStudents.map((student) => student.lrn));
  const gradeLevelByName = new Map(gradeLevelRows.map((row) => [normalizeName(row.name), row]));
  const schoolYearByName = new Map(schoolYearRows.map((row) => [normalizeName(row.name), row]));
  const seenLrns = new Set<string>();
  const validRows: StudentImportRow[] = [];
  const fieldLabels: Record<string, string> = {
    lrn: "LRN",
    firstName: "First name",
    lastName: "Last name",
    birthDate: "Birth date",
    email: "Email",
    studentType: "Student type",
    status: "Status",
    enrollmentStatus: "Enrollment status",
  };

  for (const { rowNumber, values } of candidates) {
    const parsed = studentImportRowSchema.safeParse(values);
    const rowErrors: StudentImportError[] = [];

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "File");
        rowErrors.push({
          rowNumber,
          fieldName: fieldLabels[field] ?? field,
          message: issue.message,
        });
      }
    }

    const lrn = values.lrn;
    if (lrn && seenLrns.has(lrn)) {
      rowErrors.push({ rowNumber, fieldName: "LRN", message: "This LRN appears more than once in the file." });
    }
    if (lrn) {
      seenLrns.add(lrn);
    }

    if (lrn && existingLrns.has(lrn)) {
      rowErrors.push({ rowNumber, fieldName: "LRN", message: "This LRN already belongs to a student record." });
    }

    const gradeLevel = values.gradeLevel ? gradeLevelByName.get(normalizeName(values.gradeLevel)) : undefined;
    const schoolYear = values.schoolYear ? schoolYearByName.get(normalizeName(values.schoolYear)) : undefined;

    if (values.gradeLevel && !gradeLevel) {
      rowErrors.push({ rowNumber, fieldName: "Grade level", message: "This grade level does not exist." });
    }
    if (values.schoolYear && !schoolYear) {
      rowErrors.push({ rowNumber, fieldName: "School year", message: "This school year does not exist." });
    }
    if (values.section && !values.gradeLevel) {
      rowErrors.push({ rowNumber, fieldName: "Section", message: "Choose a grade level before assigning a section." });
    } else if (values.section && gradeLevel) {
      const matchingSection = sectionRows.some((section) =>
        normalizeName(section.name) === normalizeName(values.section) &&
        (!section.gradeLevelId || section.gradeLevelId === gradeLevel.id) &&
        (!section.schoolYearId || !schoolYear || section.schoolYearId === schoolYear.id),
      );
      if (!matchingSection) {
        rowErrors.push({ rowNumber, fieldName: "Section", message: "This section does not exist for the selected grade and school year." });
      }
    }

    if (rowErrors.length > 0 || !parsed.success) {
      errors.push(...rowErrors);
      continue;
    }

    validRows.push(parsed.data);
  }

  return { totalRows: rows.length, validRows, errors };
}

export async function commitStudentImport(
  input: unknown,
  // The actor is resolved at the route boundary and the recorder is injectable
  // so the audit contract is testable outside a request scope and without a chain.
  deps: {
    actor: { id: string; role: UserRole };
    recordAudit?: (audit: AuditedActionInput) => Promise<unknown>;
  },
) {
  const request = commitSchema.parse(input);
  const validation = await validateStudentImportRows(request.rows);

  if (validation.errors.length > 0 || validation.validRows.length !== request.rows.length) {
    throw new StudentImportValidationError(validation);
  }

  const db = getDb();
  const rows = validation.validRows;
  const lrns = rows.map((row) => row.lrn);

  const importedCount = await db.transaction(async (tx) => {
    const duplicateRows = await tx.select({ lrn: students.lrn }).from(students).where(inArray(students.lrn, lrns));
    if (duplicateRows.length > 0) {
      const duplicateSet = new Set(duplicateRows.map((row) => row.lrn));
      const conflict: StudentImportValidation = {
        totalRows: rows.length,
        validRows: rows.filter((row) => !duplicateSet.has(row.lrn)),
        errors: rows.flatMap((row, index) =>
          duplicateSet.has(row.lrn)
            ? [{ rowNumber: index + 2, fieldName: "LRN", message: "This LRN was added after validation. Upload the file again to review it." }]
            : [],
        ),
      };
      throw new StudentImportConflictError(conflict);
    }

    const [legacyColumn] = await tx.execute<{ exists: boolean }>(sql`
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'students' and column_name = 'student_number'
      ) as "exists"
    `);

    const [gradeLevelRows, sectionRows, schoolYearRows] = await Promise.all([
      tx.select({ id: gradeLevels.id, name: gradeLevels.name }).from(gradeLevels),
      tx.select({ id: sections.id, name: sections.name, gradeLevelId: sections.gradeLevelId, schoolYearId: sections.schoolYearId }).from(sections),
      tx.select({ id: schoolYears.id, name: schoolYears.name }).from(schoolYears),
    ]);
    const gradeLevelByName = new Map(gradeLevelRows.map((row) => [normalizeName(row.name), row]));
    const schoolYearByName = new Map(schoolYearRows.map((row) => [normalizeName(row.name), row]));

    const insertRows = rows.map((row) => {
      const gradeLevel = row.gradeLevel ? gradeLevelByName.get(normalizeName(row.gradeLevel)) : undefined;
      const schoolYear = row.schoolYear ? schoolYearByName.get(normalizeName(row.schoolYear)) : undefined;
      const section = row.section
        ? sectionRows.find((candidate) =>
            normalizeName(candidate.name) === normalizeName(row.section) &&
            (!candidate.gradeLevelId || candidate.gradeLevelId === gradeLevel?.id) &&
            (!candidate.schoolYearId || !schoolYear || candidate.schoolYearId === schoolYear.id),
          )
        : undefined;

      if ((row.gradeLevel && !gradeLevel) || (row.schoolYear && !schoolYear) || (row.section && !section)) {
        throw new StudentImportConflictError({
          totalRows: rows.length,
          validRows: [],
          errors: [{ rowNumber: 0, fieldName: "Academic assignment", message: "An assigned grade, section, or school year changed after validation. Upload the file again." }],
        });
      }

      return {
        row,
        gradeLevelId: gradeLevel?.id,
        sectionId: section?.id,
        schoolYearId: schoolYear?.id,
      };
    });

    if (legacyColumn?.exists) {
      for (const { row, gradeLevelId, sectionId, schoolYearId } of insertRows) {
        await tx.execute(sql`
          insert into students (
            lrn, student_number, first_name, middle_name, last_name, suffix, birth_date, gender, email,
            contact_number, address, guardian_name, guardian_contact, grade_level_id, section_id,
            school_year_id, student_type, status, enrollment_status
          ) values (
            ${row.lrn}, ${row.lrn}, ${row.firstName}, ${row.middleName || null}, ${row.lastName}, ${row.suffix || null},
            ${row.birthDate ? new Date(`${row.birthDate}T00:00:00.000Z`) : null}, ${row.gender || null}, ${row.email || null},
            ${row.contactNumber || null}, ${row.address || null}, ${row.guardianName || null}, ${row.guardianContact || null},
            ${gradeLevelId ?? null}, ${sectionId ?? null}, ${schoolYearId ?? null}, cast(${row.studentType} as student_type),
            cast(${row.status} as student_status), ${row.enrollmentStatus}
          )
        `);
      }
    } else {
      await tx.insert(students).values(
        insertRows.map(({ row, gradeLevelId, sectionId, schoolYearId }) => ({
          lrn: row.lrn,
          firstName: row.firstName,
          middleName: row.middleName || null,
          lastName: row.lastName,
          suffix: row.suffix || null,
          birthDate: row.birthDate ? new Date(`${row.birthDate}T00:00:00.000Z`) : null,
          gender: row.gender || null,
          email: row.email || null,
          contactNumber: row.contactNumber || null,
          address: row.address || null,
          guardianName: row.guardianName || null,
          guardianContact: row.guardianContact || null,
          gradeLevelId: gradeLevelId ?? null,
          sectionId: sectionId ?? null,
          schoolYearId: schoolYearId ?? null,
          studentType: row.studentType,
          status: row.status,
          enrollmentStatus: row.enrollmentStatus,
        })),
      );
    }

    return insertRows.length;
  });

  // Bulk creation of PII records must leave a trace: one batch audit entry
  // naming exactly which LRNs were added and by whom.
  const batchId = generatePrefixedId("SIMPORT");
  await (deps.recordAudit ?? recordAuditedAction)({
    referenceType: "student_import",
    referenceId: batchId,
    action: "Students imported",
    actorRole: deps.actor.role,
    actorUserId: deps.actor.id,
    entityType: "student",
    entityId: batchId,
    metadata: {
      importedCount: rows.length,
      lrns,
      fileName: request.fileName ?? null,
    },
    hashMetadata: {
      importedCount: rows.length,
      lrns,
    },
  });

  return { importedCount };
}
