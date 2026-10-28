import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { isReportKey, parseReportRange, renderReportPdf } from "@/lib/services/reports";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ report: string }> },
) {
  try {
    const role = await getCurrentRole();
    if (role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const { report } = await params;
    if (!isReportKey(report)) {
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    }

    const url = new URL(request.url);
    const range = parseReportRange(
      url.searchParams.get("from") ?? undefined,
      url.searchParams.get("to") ?? undefined,
    );

    const pdf = await renderReportPdf(report, range);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lanhs-${report}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
