import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createDocumentRequest } from "@/lib/services/document-requests";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentUserOnly = url.searchParams.get("mine") === "true";
  const data = await listDocumentRequestViews({ currentUserOnly });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await createDocumentRequest(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create document request." },
      { status: 500 },
    );
  }
}
