import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ensureCurrentDbUser } from "@/lib/auth";
import { deactivateDocumentType, updateDocumentType } from "@/lib/services/document-types";
import { AppError } from "@/lib/utils";

async function requireAdmin() {
  const user = await ensureCurrentDbUser();
  if (!user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (user.role !== "admin") return { response: NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 }) };
  return { user };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const data = await updateDocumentType(id, await request.json());
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid document type." }, { status: 400 });
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to update the document type." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    await deactivateDocumentType(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to deactivate the document type." }, { status: 500 });
  }
}
