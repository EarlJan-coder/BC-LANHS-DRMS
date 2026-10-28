import { FileDown } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { DataTable, type TableColumn } from "@/components/data-table";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportDateFilter } from "@/components/report-date-filter";
import { formatPeriodLabel, listReports, parseReportRange } from "@/lib/services/reports";

const PREVIEW_LIMIT = 10;

function pdfHref(key: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `/api/reports/${key}/pdf?${query}` : `/api/reports/${key}/pdf`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const range = parseReportRange(from, to);
  const periodLabel = formatPeriodLabel(range);
  const reports = await listReports(range);

  return (
    <div>
      <SectionHeading
        title="Reports"
        description="Registrar reports for school document and certificate workflows. Pick a date range, then export any report as a PDF."
      />

      <Card className="mb-6">
        <CardContent>
          <ReportDateFilter
            initialFrom={range.fromLabel}
            initialTo={range.toLabel}
            periodLabel={periodLabel}
          />
        </CardContent>
      </Card>

      <div className="space-y-8">
        {reports.map((report) => {
          const columns: TableColumn<string[]>[] = report.columns.map((column, index) => ({
            key: column.header,
            label: column.header,
            render: (row: string[]) => row[index] ?? "",
          }));
          const previewRows = report.rows.slice(0, PREVIEW_LIMIT);
          const extra = report.rows.length - previewRows.length;

          return (
            <section key={report.key}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{report.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    <span className="font-semibold text-slate-950">{report.total}</span>{" "}
                    {report.periodNoun} &middot; {report.periodLabel}
                  </p>
                </div>
                <ButtonLink href={pdfHref(report.key, range.fromLabel, range.toLabel)} tone="primary">
                  <FileDown className="h-4 w-4" aria-hidden />
                  Export PDF
                </ButtonLink>
              </div>

              <DataTable
                columns={columns}
                rows={previewRows}
                emptyMessage="No records for the selected period."
              />

              {extra > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Showing first {PREVIEW_LIMIT} of {report.rows.length}. Export the PDF for the full report.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
