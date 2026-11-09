import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { getCurrentDbUser } from "@/lib/auth";
import {
  assertStudentRecordAccess,
  deleteStudentRecord,
  isPostgresError,
  StudentRecordError,
  updateStudentRecord,
} from "@/lib/services/student-records";
import { decideRegistration } from "@/lib/services/registrations";
import { studentRecordSchema } from "@/lib/validators";

function handleStudentRecordError(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid student record." }, { status: 400 });
  }

  if (error instanceof StudentRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isPostgresError(error, "23505", "students_lrn_idx")) {
    return NextResponse.json({ error: "This LRN already belongs to another student record." }, { status: 409 });
  }

  if (isPostgresError(error, "23505", "users_lrn_idx")) {
    return NextResponse.json({ error: "This LRN already belongs to another account." }, { status: 409 });
  }

  if (isPostgresError(error, "23505", "users_email_idx")) {
    return NextResponse.json({ error: "This email already belongs to another account." }, { status: 409 });
  }

  if (isPostgresError(error, "23503")) {
    return NextResponse.json(
      { error: "A linked record changed. Refresh the page and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertStudentRecordAccess();
    const { id } = await params;
    const values = studentRecordSchema.parse(await request.json());

    const [linkedAccount] = await getDb()
      .select({ userId: students.userId, registrationStatus: users.registrationStatus })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(eq(students.id, id))
      .limit(1);
    if (!linkedAccount) throw new StudentRecordError("Student record not found.", 404);

    const restoreAccount =
      Boolean(linkedAccount.userId) &&
      linkedAccount.registrationStatus === "declined" &&
      values.registrationStatus === "approved";
    if (
      linkedAccount.userId &&
      values.registrationStatus !== undefined &&
      values.registrationStatus !== linkedAccount.registrationStatus &&
      !restoreAccount
    ) {
      throw new StudentRecordError("Only declined accounts can be restored from this screen.", 400);
    }
    if (restoreAccount && !values.registrationNote?.trim()) {
      throw new StudentRecordError("Add an approval note for the student.", 400);
    }

    await updateStudentRecord(id, values);

    if (restoreAccount && linkedAccount.userId) {
      const actor = await getCurrentDbUser();
      if (!actor) throw new StudentRecordError("Please sign in to continue.", 401);
      await decideRegistration({
        id: linkedAccount.userId,
        decision: "approved",
        note: values.registrationNote ?? "Registration approved by the registrar.",
        actorUserId: actor.id,
        actorRole: actor.role,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleStudentRecordError(error, "Unable to update student record.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertStudentRecordAccess();
    const { id } = await params;
    await deleteStudentRecord(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleStudentRecordError(error, "Unable to delete student record.");
  }
}
