import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { clerkConfigured, getCurrentRole } from "@/lib/auth";
import { updateDocumentRequestStatus } from "@/lib/services/document-requests";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const role = await getCurrentRole();
    if (clerkConfigured() && role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updated = await updateDocumentRequestStatus(id, body, role === "admin" ? "admin" : "registrar");
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid status update." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update request status." },
      { status: 500 },
    );
  }
}
