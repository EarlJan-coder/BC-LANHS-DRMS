import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentRole } from "@/lib/auth";
import { getCertificateEditView, updateCertificateOverrides } from "@/lib/services/certificates";

/** Current effective PDF content for the preview/edit form. Staff only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = await getCurrentRole();
    if (role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const { id } = await params;
    const view = await getCertificateEditView(id);

    if (!view) {
      return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
    }

    return NextResponse.json(view);
  } catch {
    return NextResponse.json({ error: "Unable to load certificate." }, { status: 500 });
  }
}

/** Save PDF content overrides (preview/edit flow). Staff only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const role = await getCurrentRole();
    if (role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const updated = await updateCertificateOverrides(id, body);

    revalidatePath(`/registrar/certificates/${id}`);
    revalidatePath("/registrar/certificates");
    revalidatePath(`/api/certificates/${id}/pdf`);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid override values." }, { status: 400 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to update certificate.";
    const status = message === "Certificate not found." ? 404 : message === "No editable fields were provided." ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
