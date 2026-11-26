import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-guards";
import { resetDocumentTypeTemplate } from "@/lib/services/document-type-templates";
import { AppError } from "@/lib/utils";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    return NextResponse.json({ data: await resetDocumentTypeTemplate(id) });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to reset the document template." }, { status: 500 });
  }
}
