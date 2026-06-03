import { and, eq, or } from "drizzle-orm";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { db } from "@/db";
import {
  gradeImportBatches,
  gradeImportErrors,
  gradeLevels,
  schoolYears,
  sections,
  studentGrades,
  students,
  subjects,
} from "@/db/schema";
import { GRADE_IMPORT_COLUMNS } from "@/lib/constants";
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
  return `${row.lrn || row.studentNumber}|${row.schoolYear}|${row.subject}`.toLowerCase();
}

function readColumn(row: RawRow, label: string) {
  return row[label] ?? row[label.toLowerCase()] ?? row[label.replaceAll(" ", "_")];
}

export function gradeImportTemplateCsv() {
  return `${GRADE_IMPORT_COLUMNS.join(",")}\n`;
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

  const workbook = new ExcelJS.Workbook();
  type ExcelWorkbookBuffer = Parameters<typeof workbook.xlsx.load>[0];
  const workbookBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ExcelWorkbookBuffer;
  await workbook.xlsx.load(workbookBuffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    return validateGradeImportRows([]);
  }

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values)
    ? headerRow.values.slice(1)
    : Object.values(headerRow.values ?? {});
  const headers = headerValues.map((value) => String(value ?? "").trim());
  const rows: RawRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record: RawRow = {};
    headers.forEach((header, index) => {
      record[header] = row.getCell(index + 1).text;
    });

    if (Object.values(record).some((value) => clean(value))) {
      rows.push(record);
    }
  });

  return validateGradeImportRows(rows);
}

export function validateGradeImportRows(rows: RawRow[]): GradeImportValidation {
  const validRows: GradeImportRow[] = [];
  const errors: GradeImportError[] = [];
  const seen = new Set<string>();
  const duplicateKeys: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const gradeRow: GradeImportRow = {
      lrn: clean(readColumn(row, "LRN")),
      studentNumber: clean(readColumn(row, "Student Number")),
      schoolYear: clean(readColumn(row, "School Year")),
      gradeLevel: clean(readColumn(row, "Grade Level")),
      section: clean(readColumn(row, "Section")),
      subject: clean(readColumn(row, "Subject")),
      quarter1: parseGrade(readColumn(row, "Quarter 1")),
      quarter2: parseGrade(readColumn(row, "Quarter 2")),
      quarter3: parseGrade(readColumn(row, "Quarter 3")),
      quarter4: parseGrade(readColumn(row, "Quarter 4")),
      finalGrade: parseGrade(readColumn(row, "Final Grade")),
      remarks: clean(readColumn(row, "Remarks")),
    };

    const rowErrors: GradeImportError[] = [];

    if (!gradeRow.lrn && !gradeRow.studentNumber) {
      rowErrors.push({ rowNumber, fieldName: "LRN", message: "LRN or Student Number is required." });
    }

    for (const fieldName of ["schoolYear", "gradeLevel", "section", "subject"] as const) {
      if (!gradeRow[fieldName]) {
        rowErrors.push({ rowNumber, fieldName, message: `${fieldName} is required.` });
      }
    }

    for (const fieldName of ["quarter1", "quarter2", "quarter3", "quarter4", "finalGrade"] as const) {
      const grade = gradeRow[fieldName];
      if (Number.isNaN(grade) || (grade !== null && (grade < 0 || grade > 100))) {
        rowErrors.push({ rowNumber, fieldName, message: "Grade must be a number from 0 to 100." });
      }
    }

    const key = rowKey(gradeRow);
    if (seen.has(key)) {
      duplicateKeys.push(key);
      rowErrors.push({ rowNumber, fieldName: "Subject", message: "Duplicate grade entry for this student, school year, and subject." });
    }
    seen.add(key);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    validRows.push(gradeRow);
  });

  return {
    totalRows: rows.length,
    validRows,
    errors,
    duplicateKeys,
  };
}

export async function commitGradeImport(input: unknown) {
  const values = gradeImportCommitSchema.parse(input);
  const batchReference = `BATCH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  if (!db) {
    const audit = await recordAuditedAction({
      referenceId: batchReference,
      action: "Grades imported",
      actorRole: "registrar",
      entityType: "grade_import_batch",
      entityId: batchReference,
      metadata: { fileName: values.fileName, validRows: values.rows.length },
      hashMetadata: { validRows: values.rows.length },
    });

    return {
      batchReference,
      savedRows: values.rows.length,
      errors: [],
      ...audit,
    };
  }

  const [batch] = await db
    .insert(gradeImportBatches)
    .values({
      fileName: values.fileName,
      totalRows: values.rows.length,
      validRows: values.rows.length,
      invalidRows: 0,
      status: "imported",
      blockchainStatus: "pending",
    })
    .returning();

  let savedRows = 0;
  const unmatchedErrors: GradeImportError[] = [];

  for (const [index, row] of values.rows.entries()) {
    const student = await db.query.students.findFirst({
      where: or(eq(students.lrn, row.lrn), eq(students.studentNumber, row.studentNumber)),
    });
    const subject = await db.query.subjects.findFirst({
      where: or(eq(subjects.name, row.subject), eq(subjects.code, row.subject)),
    });
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
      });
      continue;
    }

    await db
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
      })
      .onConflictDoUpdate({
        target: [studentGrades.studentId, studentGrades.subjectId, studentGrades.schoolYearId],
        set: {
          gradeLevelId: gradeLevel.id,
          sectionId: section.id,
          importBatchId: batch.id,
          quarter1: row.quarter1?.toString(),
          quarter2: row.quarter2?.toString(),
          quarter3: row.quarter3?.toString(),
          quarter4: row.quarter4?.toString(),
          finalGrade: row.finalGrade?.toString(),
          remarks: row.remarks,
          updatedAt: new Date(),
        },
      });
    savedRows += 1;
  }

  if (unmatchedErrors.length > 0) {
    await db.insert(gradeImportErrors).values(
      unmatchedErrors.map((error) => ({
        batchId: batch.id,
        rowNumber: error.rowNumber,
        fieldName: error.fieldName,
        message: error.message,
      })),
    );
  }

  const audit = await recordAuditedAction({
    referenceId: batchReference,
    action: "Grades imported",
    actorRole: "registrar",
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

  return {
    batchReference,
    savedRows,
    errors: unmatchedErrors,
    ...audit,
  };
}
