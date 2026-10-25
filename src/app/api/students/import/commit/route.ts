import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentDbUser, getCurrentRole } from "@/lib/auth";
import {
  commitStudentImport,
  StudentImportConflictError,
  StudentImportValidationError,
} from "@/lib/services/student-import";
import { isPostgresError } from "@/lib/services/student-records";

export async function POST(request: Request) {
  const role = await getCurrentRole();
  if (role !== "registrar" && role !== "admin") {
    return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
  }

  const actor = await getCurrentDbUser();
  if (!actor) {
    return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const result = await commitStudentImport(await request.json(), { actor });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid student import." }, { status: 400 });
    }

    if (error instanceof StudentImportValidationError || error instanceof StudentImportConflictError) {
      return NextResponse.json({ error: error.message, validation: error.validation }, { status: 409 });
    }

    if (isPostgresError(error, "23505", "students_lrn_idx")) {
      return NextResponse.json(
        { error: "A student with one of these LRNs was added after validation. Upload the file again to review it." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Unable to import students right now." }, { status: 500 });
  }
}
