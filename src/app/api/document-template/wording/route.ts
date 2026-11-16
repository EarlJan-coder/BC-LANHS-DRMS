import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/api-guards";
import { TooLongBodyError } from "@/lib/services/certificate-body-layout";
import {
  getDocumentTemplateWording,
  resetDocumentTemplateWording,
  saveDocumentTemplateWording,
} from "@/lib/services/document-template-wording";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ data: await getDocumentTemplateWording() });
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await saveDocumentTemplateWording(await request.json()) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
    if (error instanceof TooLongBodyError) return NextResponse.json({ error: "Body text is too long for this document." }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to save the document template." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const template = new URL(request.url).searchParams.get("template") ?? "";
    return NextResponse.json({ data: await resetDocumentTemplateWording(template) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Unknown template." }, { status: 400 });
    return NextResponse.json({ error: "Unable to save the document template." }, { status: 500 });
  }
}
