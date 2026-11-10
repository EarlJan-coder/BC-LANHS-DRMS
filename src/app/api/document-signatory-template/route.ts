import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ensureCurrentDbUser } from "@/lib/auth";
import { getDocumentSignatoryTemplate, saveDocumentSignatoryTemplate } from "@/lib/services/document-signatory-template";

async function requireAdmin() {
  const user = await ensureCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ data: await getDocumentSignatoryTemplate() });
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await saveDocumentSignatoryTemplate(await request.json()) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the signatory names." }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to save the document template." }, { status: 500 });
  }
}
