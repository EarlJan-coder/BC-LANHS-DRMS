import { count, eq } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { certificates, documentRequests, students, users } from "@/db/schema";
import { getCurrentRole } from "@/lib/auth";
import { AppError } from "@/lib/utils";
import { studentRecordSchema } from "@/lib/validators";

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

export async function deleteStudentRecord(id: string) {
  const db = getDb();
  const [requestCount, certificateCount] = await Promise.all([
    db.select({ value: count() }).from(documentRequests).where(eq(documentRequests.studentId, id)),
    db.select({ value: count() }).from(certificates).where(eq(certificates.studentId, id)),
  ]);

  const linkedRecords = Number(requestCount[0]?.value ?? 0) + Number(certificateCount[0]?.value ?? 0);

  if (linkedRecords > 0) {
    throw new StudentRecordError(
      "This student has linked document requests or certificates. Update the status instead.",
      409,
    );
  }

  const [deleted] = await db.delete(students).where(eq(students.id, id)).returning({ id: students.id });

  if (!deleted) {
    throw new StudentRecordError("Student record not found.", 404);
  }

  return deleted;
}
