import { BarChart3 } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { getReportSummaryCards } from "@/lib/services/live-data";

export default async function ReportsPage() {
  const reports = await getReportSummaryCards();

  return (
    <div>
      <SectionHeading title="Reports" description="Registrar exports for school document and grade record workflows." />
      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.title} className="flex items-center gap-3 p-5">
            <BarChart3 className="h-5 w-5 text-brand" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-slate-950">{report.title}: {report.value}</h2>
              <p className="mt-1 text-sm text-slate-500">{report.helper}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
