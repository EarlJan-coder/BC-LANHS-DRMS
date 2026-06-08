import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDb } from "@/db";
import { students } from "@/db/schema";
import { clerkConfigured, getCurrentRole } from "@/lib/auth";
import { listStudentViews } from "@/lib/services/live-data";
import { studentRecordSchema } from "@/lib/validators";

export async function GET() {
  return NextResponse.json({ data: await listStudentViews() });
}

export async function POST(request: Request) {
  try {
    const role = await getCurrentRole();
    if (clerkConfigured() && role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const body = await request.json();
    const values = studentRecordSchema.parse(body);
    const db = getDb();

    const [created] = await db
      .insert(students)
      .values({
        lrn: values.lrn,
        firstName: values.firstName,
        middleName: values.middleName || undefined,
        lastName: values.lastName,
        suffix: values.suffix || undefined,
        contactNumber: values.contactNumber || undefined,
        guardianName: values.guardianName || undefined,
        guardianContact: values.guardianContact || undefined,
        address: values.address || undefined,
        gradeLevelId: values.gradeLevelId || undefined,
        sectionId: values.sectionId || undefined,
        enrollmentStatus: values.enrollmentStatus,
      })
      .returning();

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid student record." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save student record." },
      { status: 500 },
    );
  }
}
