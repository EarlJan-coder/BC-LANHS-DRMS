import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ensureCurrentDbUser } from "@/lib/auth";
import { listDocumentTypeViews } from "@/lib/services/live-data";
import { createDocumentType } from "@/lib/services/document-types";
import { AppError } from "@/lib/utils";

async function requireAdmin() {
  const user = await ensureCurrentDbUser();
  if (!user) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (user.role !== "admin") return { response: NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  return NextResponse.json({ data: await listDocumentTypeViews() });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  try {
    const data = await createDocumentType(await request.json());
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid document type." }, { status: 400 });
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Unable to create the document type." }, { status: 500 });
  }
}
