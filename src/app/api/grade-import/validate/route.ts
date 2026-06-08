import { NextResponse } from "next/server";
import { clerkConfigured, getCurrentRole } from "@/lib/auth";
import { parseGradeImportFile } from "@/lib/services/grade-import";

export async function POST(request: Request) {
  try {
    const role = await getCurrentRole();
    if (clerkConfigured() && role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || !file.name) {
      return NextResponse.json({ error: "Upload a CSV, XLS, or XLSX file." }, { status: 400 });
    }

    if (!/\.(csv|xls|xlsx)$/i.test(file.name)) {
      return NextResponse.json({ error: "Only CSV, XLS, and XLSX files are accepted." }, { status: 400 });
    }

    const validation = await parseGradeImportFile(file);
    return NextResponse.json(validation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to validate grade import file." },
      { status: 500 },
    );
  }
}
