import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { parseReportFilters, parseReportRange, renderAllReportsPdf } from "@/lib/services/reports";

/** Combined PDF of every registrar report under one period + filter set. */
export async function GET(request: Request) {
  try {
    const role = await getCurrentRole();
    if (role !== "registrar" && role !== "admin") {
      return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
    }

    const url = new URL(request.url);
    const range = parseReportRange(
      url.searchParams.get("from") ?? undefined,
      url.searchParams.get("to") ?? undefined,
    );
    const filters = parseReportFilters(
      url.searchParams.get("documentType") ?? undefined,
      url.searchParams.get("status") ?? undefined,
      url.searchParams.get("gradeLevel") ?? undefined,
    );

    const pdf = await renderAllReportsPdf(range, filters);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lanhs-reports-all.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
