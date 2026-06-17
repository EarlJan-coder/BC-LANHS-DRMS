import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  assertStudentRecordAccess,
  createStudentRecord,
  isPostgresError,
  StudentRecordError,
} from "@/lib/services/student-records";
import { listStudentViews } from "@/lib/services/live-data";
import { studentRecordSchema } from "@/lib/validators";

function handleStudentRecordError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid student record." }, { status: 400 });
  }

  if (error instanceof StudentRecordError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (isPostgresError(error, "23505", "students_lrn_idx")) {
    return NextResponse.json({ error: "This LRN already belongs to another student record." }, { status: 409 });
  }

  if (isPostgresError(error, "23502", "student_number")) {
    return NextResponse.json(
      { error: "The database still has the old student number column. Run npm run db:migrate, then try again." },
      { status: 409 },
    );
  }

  if (isPostgresError(error, "23503")) {
    return NextResponse.json(
      { error: "The selected grade level or section no longer exists. Refresh the page and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { error: "Unable to save student record." },
    { status: 500 },
  );
}

export async function GET() {
  return NextResponse.json({ data: await listStudentViews() });
}

export async function POST(request: Request) {
  try {
    await assertStudentRecordAccess();
    const body = await request.json();
    const values = studentRecordSchema.parse(body);
    const created = await createStudentRecord(values);

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return handleStudentRecordError(error);
  }
}
