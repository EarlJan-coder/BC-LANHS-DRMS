import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { commitGradeImport } from "@/lib/services/grade-import";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await commitGradeImport(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid grade import data." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save grade import." },
      { status: 500 },
    );
  }
}

