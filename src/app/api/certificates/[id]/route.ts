import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { getCertificateEditView } from "@/lib/services/certificates";

/** Current effective PDF display values for certificate details. Staff only. */
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
