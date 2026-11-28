import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { renderAuditTrailPdf } from "@/lib/services/reports";

export async function GET() {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const pdf = await renderAuditTrailPdf();
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="lanhs-audit-trail.pdf"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the audit trail report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
