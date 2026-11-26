import { eq, inArray, or } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { certificates, documentRequests, requestStatusHistory, students, users, type UserRole } from "@/db/schema";
import { getCurrentRole } from "@/lib/auth";
import { AppError } from "@/lib/utils";
import { studentRecordSchema } from "@/lib/validators";
import { deletePortalAccount } from "@/lib/services/account-admin";
import { recordAuditedAction } from "@/lib/services/audit-log";

export class StudentRecordError extends AppError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = "StudentRecordError";
  }
}

export type StudentRecordValues = z.infer<typeof studentRecordSchema>;

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

export async function updateStudentRecord(id: string, values: StudentRecordValues) {
  const db = getDb();
  const [existing] = await db
    .select({ id: students.id, userId: students.userId, email: students.email })
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  if (!existing) {
    throw new StudentRecordError("Student record not found.", 404);
  }

  return db.transaction(async (tx) => {
    const linkedUser = existing.userId
      ? await tx.query.users.findFirst({ where: eq(users.id, existing.userId) })
      : null;

    if (existing.userId && !linkedUser) {
      throw new StudentRecordError("The linked account could not be found.", 409);
    }

    const nextEmail = values.email?.trim() || linkedUser?.email || existing.email || null;
    if (linkedUser) {
      await tx
        .update(users)
        .set({
          lrn: values.lrn,
          email: nextEmail ?? linkedUser.email,
          firstName: values.firstName,
          middleName: optionalText(values.middleName),
          lastName: values.lastName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, linkedUser.id));
    }

    const [updated] = await tx
      .update(students)
      .set({
        lrn: values.lrn,
        firstName: values.firstName,
        middleName: optionalText(values.middleName),
        lastName: values.lastName,
        suffix: optionalText(values.suffix),
        email: nextEmail,
        contactNumber: optionalText(values.contactNumber),
        address: optionalText(values.address),
        // Only touch the column when the key was sent — omitting it must not
        // wipe an existing value.
        ...(values.lastSchoolYearAttended !== undefined
          ? { lastSchoolYearAttended: optionalText(values.lastSchoolYearAttended) }
          : {}),
        status: values.enrollmentStatus,
        enrollmentStatus: values.enrollmentStatus,
        updatedAt: new Date(),
      })
      .where(eq(students.id, id))
      .returning({ id: students.id });

    if (!updated) throw new StudentRecordError("Student record not found.", 404);
    return updated;
  });
}

export async function deleteStudentRecord(id: string, actor: { id: string; role: UserRole }): Promise<{ id: string }> {
  const db = getDb();
  const [student] = await db.select({ id: students.id, userId: students.userId }).from(students).where(eq(students.id, id)).limit(1);
  if (!student) throw new StudentRecordError("Student record not found.", 404);
  if (student.userId) {
    await deletePortalAccount(student.userId, actor);
    return { id };
  }

  await db.transaction(async (tx) => {
    const requestRows = await tx.select({ id: documentRequests.id }).from(documentRequests).where(eq(documentRequests.studentId, id));
    const requestIds = requestRows.map((row) => row.id);
    if (requestIds.length) {
      await tx.delete(requestStatusHistory).where(inArray(requestStatusHistory.requestId, requestIds));
      await tx.delete(certificates).where(or(inArray(certificates.requestId, requestIds), eq(certificates.studentId, id)));
      await tx.delete(documentRequests).where(inArray(documentRequests.id, requestIds));
    } else {
      await tx.delete(certificates).where(eq(certificates.studentId, id));
    }
    await tx.delete(students).where(eq(students.id, id));
  });
  await recordAuditedAction({
    referenceType: "student",
    referenceId: id,
    action: "student.delete",
    entityType: "student",
    entityId: id,
    actorUserId: actor.id,
    actorRole: actor.role,
    description: "Student record deleted",
    metadata: {},
    hashMetadata: {},
  });
  return { id };
}
