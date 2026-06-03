import { NextResponse } from "next/server";
import { parseGradeImportFile } from "@/lib/services/grade-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || !file.name) {
      return NextResponse.json({ error: "Upload a CSV, XLS, or XLSX file." }, { status: 400 });
    }

    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      return NextResponse.json({ error: "Only CSV and XLSX files are accepted." }, { status: 400 });
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
