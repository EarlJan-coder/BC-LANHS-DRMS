import { NextResponse } from "next/server";
import {
  assertStudentRecordAccess,
  StudentRecordError,
} from "@/lib/services/student-records";
import { listStudentViews } from "@/lib/services/live-data";

export async function GET() {
  try {
    await assertStudentRecordAccess();
    return NextResponse.json({ data: await listStudentViews() });
  } catch (error) {
    if (error instanceof StudentRecordError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load student records." }, { status: 500 });
  }
}
