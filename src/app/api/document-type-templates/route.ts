import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api-guards";
import { TooLongBodyError } from "@/lib/services/certificate-body-layout";
import { listDocumentTypeTemplates, saveDocumentTypeTemplate } from "@/lib/services/document-type-templates";
import { AppError } from "@/lib/utils";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ data: await listDocumentTypeTemplates() });
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await saveDocumentTypeTemplate(await request.json()) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid template." }, { status: 400 });
    if (error instanceof TooLongBodyError) return NextResponse.json({ error: "Body text is too long for this layout." }, { status: 400 });
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to save the document template." }, { status: 500 });
  }
}

