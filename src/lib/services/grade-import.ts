import { and, eq, or } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { db } from "@/db";
import {
  gradeImportBatches,
  gradeImportErrors,
  gradeLevels,
  notifications,
  schoolYears,
  sections,
  studentGrades,
  students,
  subjects,
} from "@/db/schema";
import { ensureCurrentDbUser } from "@/lib/auth";
import { GRADE_IMPORT_COLUMNS } from "@/lib/constants";
import { sendWorkflowEmail } from "@/lib/email";
import type { GradeImportError, GradeImportRow, GradeImportValidation } from "@/lib/types";
import { gradeImportCommitSchema } from "@/lib/validators";
import { recordAuditedAction } from "./audit-log";

type RawRow = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseGrade(value: unknown) {
  const normalized = clean(value);
  if (!normalized) {
    return null;
  }

  const grade = Number(normalized);
  return Number.isFinite(grade) ? grade : Number.NaN;
}

function rowKey(row: GradeImportRow) {
  return `${row.lrn}|${row.schoolYear}|${row.subjectCode || row.subjectName}`.toLowerCase();
}

function readColumn(row: RawRow, label: string) {
  return row[label] ?? row[label.toLowerCase()] ?? row[label.replaceAll(" ", "_")];
}

function batchNumber() {
  return `BATCH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export function gradeImportTemplateCsv() {
  return `${GRADE_IMPORT_COLUMNS.join(",")}\n`;
}

export function gradeImportTemplateXlsx() {
  const worksheet = XLSX.utils.aoa_to_sheet([GRADE_IMPORT_COLUMNS]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Grade Import");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function parseGradeImportFile(file: File): Promise<GradeImportValidation> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (/\.csv$/i.test(file.name)) {
    const rows = parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as RawRow[];

    return validateGradeImportRows(rows);
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!worksheet) {
    return validateGradeImportRows([]);
  }

  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: "" });
  return validateGradeImportRows(rows);
}

export async function validateGradeImportRows(rows: RawRow[]): Promise<GradeImportValidation> {
  const validRows: GradeImportRow[] = [];
  const errors: GradeImportError[] = [];
  const seen = new Set<string>();
  const duplicateKeys: string[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const gradeRow: GradeImportRow = {
      lrn: clean(readColumn(row, "LRN")),
      firstName: clean(readColumn(row, "First Name")),
      lastName: clean(readColumn(row, "Last Name")),
      schoolYear: clean(readColumn(row, "School Year")),
      gradeLevel: clean(readColumn(row, "Grade Level")),
      section: clean(readColumn(row, "Section")),
      subjectCode: clean(readColumn(row, "Subject Code")),
      subjectName: clean(readColumn(row, "Subject Name")),
      quarter1: parseGrade(readColumn(row, "Quarter 1")),
      quarter2: parseGrade(readColumn(row, "Quarter 2")),
      quarter3: parseGrade(readColumn(row, "Quarter 3")),
      quarter4: parseGrade(readColumn(row, "Quarter 4")),
      finalGrade: parseGrade(readColumn(row, "Final Grade")),
      remarks: clean(readColumn(row, "Remarks")),
    };

    const rowErrors: GradeImportError[] = [];

    if (!gradeRow.lrn) {
      rowErrors.push({ rowNumber, fieldName: "LRN", message: "LRN is required.", rawData: row });
    }

    for (const fieldName of ["schoolYear", "gradeLevel", "section"] as const) {
      if (!gradeRow[fieldName]) {
        rowErrors.push({ rowNumber, fieldName, message: `${fieldName} is required.`, rawData: row });
      }
    }

    if (!gradeRow.subjectCode && !gradeRow.subjectName) {
      rowErrors.push({ rowNumber, fieldName: "Subject", message: "Subject Code or Subject Name is required.", rawData: row });
    }

    for (const fieldName of ["quarter1", "quarter2", "quarter3", "quarter4", "finalGrade"] as const) {
      const grade = gradeRow[fieldName];
      if (Number.isNaN(grade) || (grade !== null && (grade < 0 || grade > 100))) {
        rowErrors.push({ rowNumber, fieldName, message: "Grade must be a number from 0 to 100.", rawData: row });
      }
    }

    const key = rowKey(gradeRow);
    if (seen.has(key)) {
      duplicateKeys.push(key);
      rowErrors.push({
        rowNumber,
        fieldName: "Subject",
        message: "Duplicate row in this file for the same student, school year, and subject.",
        rawData: row,
      });
    }
    seen.add(key);

    if (db && rowErrors.length === 0) {
      const student = await findStudent(gradeRow);
      const schoolYear = await db.query.schoolYears.findFirst({
        where: eq(schoolYears.name, gradeRow.schoolYear),
      });
      const gradeLevel = await db.query.gradeLevels.findFirst({
        where: eq(gradeLevels.name, gradeRow.gradeLevel),
      });
      const section = await db.query.sections.findFirst({
        where: gradeLevel
          ? and(eq(sections.name, gradeRow.section), eq(sections.gradeLevelId, gradeLevel.id))
          : eq(sections.name, gradeRow.section),
      });
      const subject = await findSubject(gradeRow);

      if (!student) {
        rowErrors.push({ rowNumber, fieldName: "Student", message: "Student does not exist in the system.", rawData: row });
      }
      if (!schoolYear) {
        rowErrors.push({ rowNumber, fieldName: "School Year", message: "School year does not exist.", rawData: row });
      }
      if (!gradeLevel) {
        rowErrors.push({ rowNumber, fieldName: "Grade Level", message: "Grade level does not exist.", rawData: row });
      }
      if (!section) {
        rowErrors.push({ rowNumber, fieldName: "Section", message: "Section does not exist for this grade level.", rawData: row });
      }
      if (!subject) {
        rowErrors.push({ rowNumber, fieldName: "Subject", message: "Subject does not exist.", rawData: row });
      }

      if (student && subject && schoolYear) {
        const duplicate = await db.query.studentGrades.findFirst({
          where: and(
            eq(studentGrades.studentId, student.id),
            eq(studentGrades.subjectId, subject.id),
            eq(studentGrades.schoolYearId, schoolYear.id),
          ),
        });

        if (duplicate) {
          duplicateKeys.push(key);
          rowErrors.push({
            rowNumber,
            fieldName: "Subject",
            message: "A grade record already exists for this student, subject, and school year.",
            rawData: row,
          });
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    validRows.push(gradeRow);
  }

  return {
    totalRows: rows.length,
    validRows,
    errors,
    duplicateKeys,
  };
}

async function findStudent(row: GradeImportRow) {
  if (!db) {
    return null;
  }

  return db.query.students.findFirst({
    where: eq(students.lrn, row.lrn),
  });
}

async function findSubject(row: GradeImportRow) {
  if (!db) {
    return null;
  }

  if (row.subjectCode && row.subjectName) {
    return db.query.subjects.findFirst({
      where: or(eq(subjects.code, row.subjectCode), eq(subjects.name, row.subjectName)),
    });
  }

  return db.query.subjects.findFirst({
    where: row.subjectCode ? eq(subjects.code, row.subjectCode) : eq(subjects.name, row.subjectName),
  });
}

export async function commitGradeImport(input: unknown) {
  const values = gradeImportCommitSchema.parse(input);
  const reference = batchNumber();

  if (!db) {
    const audit = await recordAuditedAction({
      referenceType: "grade_import_batch",
      referenceId: reference,
      action: "Grade batch imported",
      actorRole: "registrar",
      entityType: "grade_import_batch",
      entityId: reference,
      metadata: { fileName: values.fileName, validRows: values.rows.length },
      hashMetadata: { validRows: values.rows.length },
    });

    return {
      batchReference: reference,
      savedRows: values.rows.length,
      errors: [],
      ...audit,
    };
  }

  const actor = await ensureCurrentDbUser();
  const firstSchoolYear = await db.query.schoolYears.findFirst({
    where: eq(schoolYears.name, values.rows[0]?.schoolYear ?? ""),
  });

  const [batch] = await db
    .insert(gradeImportBatches)
    .values({
      batchNumber: reference,
      fileName: values.fileName,
      schoolYearId: firstSchoolYear?.id,
      importedByUserId: actor?.id,
      uploadedBy: actor?.id,
      totalRows: values.rows.length,
      validRows: values.rows.length,
      invalidRows: 0,
      importedRows: 0,
      status: "importing",
      blockchainStatus: "pending",
    })
    .returning();

  let savedRows = 0;
  const unmatchedErrors: GradeImportError[] = [];

  for (const [index, row] of values.rows.entries()) {
    const student = await findStudent(row);
    const subject = await findSubject(row);
    const schoolYear = await db.query.schoolYears.findFirst({
      where: eq(schoolYears.name, row.schoolYear),
    });
    const gradeLevel = await db.query.gradeLevels.findFirst({
      where: eq(gradeLevels.name, row.gradeLevel),
    });
    const section = await db.query.sections.findFirst({
      where: gradeLevel
        ? and(eq(sections.name, row.section), eq(sections.gradeLevelId, gradeLevel.id))
        : eq(sections.name, row.section),
    });

    if (!student || !subject || !schoolYear || !gradeLevel || !section) {
      unmatchedErrors.push({
        rowNumber: index + 2,
        fieldName: "Student/Subject",
        message: "Could not match the row to existing student, subject, school year, grade level, or section records.",
        rawData: row,
      });
      continue;
    }

    const inserted = await db
      .insert(studentGrades)
      .values({
        studentId: student.id,
        subjectId: subject.id,
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        sectionId: section.id,
        importBatchId: batch.id,
        quarter1: row.quarter1?.toString(),
        quarter2: row.quarter2?.toString(),
        quarter3: row.quarter3?.toString(),
        quarter4: row.quarter4?.toString(),
        finalGrade: row.finalGrade?.toString(),
        remarks: row.remarks,
        encodedBy: actor?.id,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      savedRows += 1;
    } else {
      unmatchedErrors.push({
        rowNumber: index + 2,
        fieldName: "Subject",
        message: "Duplicate grade record was skipped.",
        rawData: row,
      });
    }
  }

  if (unmatchedErrors.length > 0) {
    await db.insert(gradeImportErrors).values(
      unmatchedErrors.map((error) => ({
        batchId: batch.id,
        rowNumber: error.rowNumber,
        fieldName: error.fieldName,
        errorMessage: error.message,
        message: error.message,
        rawData: error.rawData,
      })),
    );
  }

  await db
    .update(gradeImportBatches)
    .set({
      importedRows: savedRows,
      invalidRows: unmatchedErrors.length,
      status: unmatchedErrors.length > 0 ? "partial" : "imported",
      updatedAt: new Date(),
    })
    .where(eq(gradeImportBatches.id, batch.id));

  const audit = await recordAuditedAction({
    referenceType: "grade_import_batch",
    referenceId: reference,
    action: "Grade batch imported",
    actorRole: actor?.role ?? "registrar",
    actorUserId: actor?.id,
    entityType: "grade_import_batch",
    entityId: batch.id,
    metadata: {
      fileName: values.fileName,
      savedRows,
      unmatchedRows: unmatchedErrors.length,
    },
    hashMetadata: {
      savedRows,
      unmatchedRows: unmatchedErrors.length,
    },
  });

  await db
    .update(gradeImportBatches)
    .set({
      blockchainTxHash: audit.blockchainTransactionHash ?? undefined,
      blockchainStatus: audit.blockchainStatus === "submitted" ? "submitted" : "pending",
      recordHash: audit.recordHash,
      updatedAt: new Date(),
    })
    .where(eq(gradeImportBatches.id, batch.id));

  if (actor?.id) {
    await db.insert(notifications).values({
      userId: actor.id,
      type: "grade",
      title: "Grade import completed",
      message: `${reference} saved ${savedRows} row(s) with ${unmatchedErrors.length} skipped row(s).`,
    });

    await sendWorkflowEmail({
      to: actor.email,
      studentName: `${actor.firstName} ${actor.lastName}`,
      subject: `LANHS DRMS grade import completed: ${reference}`,
      instruction: `${reference} saved ${savedRows} grade row(s). ${unmatchedErrors.length} row(s) were skipped.`,
    });
  }

  return {
    batchReference: reference,
    savedRows,
    errors: unmatchedErrors,
    ...audit,
  };
}
