import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  assertStudentRecordAccess,
  deleteStudentRecord,
  isPostgresError,
  StudentRecordError,
  updateStudentRecord,
} from "@/lib/services/student-records";
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

  if (isPostgresError(error, "23503")) {
    return NextResponse.json(
      { error: "The selected grade level, section, or linked record no longer exists. Refresh the page and try again." },
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
    await updateStudentRecord(id, values);

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
