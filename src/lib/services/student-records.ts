import { count, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { certificates, documentRequests, gradeLevels, sections, studentGrades, students } from "@/db/schema";
import { getCurrentRole } from "@/lib/auth";
import { studentRecordSchema } from "@/lib/validators";

export class StudentRecordError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "StudentRecordError";
    this.status = status;
  }
}

export type StudentRecordValues = z.infer<typeof studentRecordSchema>;

type StudentRecordDb = ReturnType<typeof getDb>;

export function postgresCause(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const cause = "cause" in error ? (error as { cause?: unknown }).cause : error;

  if (!cause || typeof cause !== "object") {
    return null;
  }

  return cause as {
    code?: unknown;
    column_name?: unknown;
    constraint_name?: unknown;
    message?: unknown;
  };
}

export function isPostgresError(error: unknown, code: string, text?: string) {
  const cause = postgresCause(error);
  const message = String(cause?.message ?? "");
  const column = String(cause?.column_name ?? "");
  const constraint = String(cause?.constraint_name ?? "");

  return (
    cause?.code === code &&
    (!text || message.includes(text) || column.includes(text) || constraint.includes(text))
  );
}

export async function assertStudentRecordAccess() {
  const role = await getCurrentRole();

  if (role !== "registrar" && role !== "admin") {
    throw new StudentRecordError("Registrar access is required.", 403);
  }

  return role;
}

function optionalText(value?: string) {
  return value?.trim() || null;
}

async function hasLegacyStudentNumberColumn(db: StudentRecordDb) {
  const rows = await db.execute<{ exists: boolean }>(sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'students'
        and column_name = 'student_number'
    ) as "exists"
  `);

  return Boolean(rows[0]?.exists);
}

async function ensureStudentRecordReferences(values: StudentRecordValues, currentStudentId?: string) {
  const db = getDb();
  const existing = await db.query.students.findFirst({
    where: eq(students.lrn, values.lrn),
  });

  if (existing && existing.id !== currentStudentId) {
    throw new StudentRecordError("This LRN already belongs to another student record.", 409);
  }

  if (values.sectionId && !values.gradeLevelId) {
    throw new StudentRecordError("Select a grade level before choosing a section.");
  }

  const [gradeLevel, section] = await Promise.all([
    values.gradeLevelId
      ? db.query.gradeLevels.findFirst({ where: eq(gradeLevels.id, values.gradeLevelId) })
      : Promise.resolve(null),
    values.sectionId ? db.query.sections.findFirst({ where: eq(sections.id, values.sectionId) }) : Promise.resolve(null),
  ]);

  if (values.gradeLevelId && !gradeLevel) {
    throw new StudentRecordError("Select an existing grade level.");
  }

  if (values.sectionId && !section) {
    throw new StudentRecordError("Select an existing section.");
  }

  if (values.gradeLevelId && section?.gradeLevelId && section.gradeLevelId !== values.gradeLevelId) {
    throw new StudentRecordError("The selected section does not belong to the selected grade level.");
  }
}

export async function createStudentRecord(values: StudentRecordValues) {
  const db = getDb();
  await ensureStudentRecordReferences(values);

  if (await hasLegacyStudentNumberColumn(db)) {
    const rows = await db.execute<{ id: string }>(sql`
      insert into students (
        lrn,
        student_number,
        first_name,
        middle_name,
        last_name,
        suffix,
        contact_number,
        guardian_name,
        guardian_contact,
        address,
        grade_level_id,
        section_id,
        status,
        enrollment_status
      )
      values (
        ${values.lrn},
        ${values.lrn},
        ${values.firstName},
        ${optionalText(values.middleName)},
        ${values.lastName},
        ${optionalText(values.suffix)},
        ${optionalText(values.contactNumber)},
        ${optionalText(values.guardianName)},
        ${optionalText(values.guardianContact)},
        ${optionalText(values.address)},
        ${values.gradeLevelId || null},
        ${values.sectionId || null},
        cast(${values.enrollmentStatus} as student_status),
        ${values.enrollmentStatus}
      )
      returning id
    `);

    return rows[0];
  }

  const [created] = await db
    .insert(students)
    .values({
      lrn: values.lrn,
      firstName: values.firstName,
      middleName: optionalText(values.middleName) ?? undefined,
      lastName: values.lastName,
      suffix: optionalText(values.suffix) ?? undefined,
      contactNumber: optionalText(values.contactNumber) ?? undefined,
      guardianName: optionalText(values.guardianName) ?? undefined,
      guardianContact: optionalText(values.guardianContact) ?? undefined,
      address: optionalText(values.address) ?? undefined,
      gradeLevelId: values.gradeLevelId || undefined,
      sectionId: values.sectionId || undefined,
      status: values.enrollmentStatus,
      enrollmentStatus: values.enrollmentStatus,
    })
    .returning({ id: students.id });

  return created;
}

export async function updateStudentRecord(id: string, values: StudentRecordValues) {
  const db = getDb();
  const [existing] = await db.select({ id: students.id }).from(students).where(eq(students.id, id)).limit(1);

  if (!existing) {
    throw new StudentRecordError("Student record not found.", 404);
  }

  await ensureStudentRecordReferences(values, id);

  if (await hasLegacyStudentNumberColumn(db)) {
    const rows = await db.execute<{ id: string }>(sql`
      update students
      set
        lrn = ${values.lrn},
        student_number = ${values.lrn},
        first_name = ${values.firstName},
        middle_name = ${optionalText(values.middleName)},
        last_name = ${values.lastName},
        suffix = ${optionalText(values.suffix)},
        contact_number = ${optionalText(values.contactNumber)},
        guardian_name = ${optionalText(values.guardianName)},
        guardian_contact = ${optionalText(values.guardianContact)},
        address = ${optionalText(values.address)},
        grade_level_id = ${values.gradeLevelId || null},
        section_id = ${values.sectionId || null},
        status = cast(${values.enrollmentStatus} as student_status),
        enrollment_status = ${values.enrollmentStatus},
        updated_at = now()
      where id = ${id}
      returning id
    `);

    if (!rows[0]) {
      throw new StudentRecordError("Student record not found.", 404);
    }

    return rows[0];
  }

  const [updated] = await db
    .update(students)
    .set({
      lrn: values.lrn,
      firstName: values.firstName,
      middleName: optionalText(values.middleName),
      lastName: values.lastName,
      suffix: optionalText(values.suffix),
      contactNumber: optionalText(values.contactNumber),
      guardianName: optionalText(values.guardianName),
      guardianContact: optionalText(values.guardianContact),
      address: optionalText(values.address),
      gradeLevelId: values.gradeLevelId || null,
      sectionId: values.sectionId || null,
      status: values.enrollmentStatus,
      enrollmentStatus: values.enrollmentStatus,
      updatedAt: new Date(),
    })
    .where(eq(students.id, id))
    .returning({ id: students.id });

  if (!updated) {
    throw new StudentRecordError("Student record not found.", 404);
  }

  return updated;
}

export async function deleteStudentRecord(id: string) {
  const db = getDb();
  const [requestCount, gradeCount, certificateCount] = await Promise.all([
    db.select({ value: count() }).from(documentRequests).where(eq(documentRequests.studentId, id)),
    db.select({ value: count() }).from(studentGrades).where(eq(studentGrades.studentId, id)),
    db.select({ value: count() }).from(certificates).where(eq(certificates.studentId, id)),
  ]);

  const linkedRecords =
    Number(requestCount[0]?.value ?? 0) +
    Number(gradeCount[0]?.value ?? 0) +
    Number(certificateCount[0]?.value ?? 0);

  if (linkedRecords > 0) {
    throw new StudentRecordError(
      "This student has linked grades, document requests, or certificates. Update the status instead.",
      409,
    );
  }

  const [deleted] = await db.delete(students).where(eq(students.id, id)).returning({ id: students.id });

  if (!deleted) {
    throw new StudentRecordError("Student record not found.", 404);
  }

  return deleted;
}
