import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth";
import { getReportSummaryCards } from "@/lib/services/live-data";

export async function GET() {
  const role = await getCurrentRole();
  if (role !== "registrar" && role !== "admin") {
    return NextResponse.json({ error: "Registrar access is required." }, { status: 403 });
  }

  const rows = await getReportSummaryCards();
  const csv = [
    "Report,Value,Description",
    ...rows.map((row) => [row.title, row.value, row.helper].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="lanhs-report-summary.csv"',
    },
  });
}
