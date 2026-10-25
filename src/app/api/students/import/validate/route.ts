import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { parseStudentImportFile, StudentImportFileError, validateStudentImportRows } from "@/lib/services/student-import";

export async function POST(request: Request) {
  const role = await getCurrentRole();
  if (role !== "registrar" && role !== "admin") {
    return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name) {
      return NextResponse.json({ error: "Choose a CSV or Excel file first." }, { status: 400 });
    }

    const rows = await parseStudentImportFile(file);
    const validation = await validateStudentImportRows(rows);
    return NextResponse.json(validation);
  } catch (error) {
    if (error instanceof StudentImportFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to validate the student file right now." }, { status: 500 });
  }
}
