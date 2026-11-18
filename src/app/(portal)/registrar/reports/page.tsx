import { FileDown } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { DataTable, type TableColumn } from "@/components/data-table";
import { DownloadButton } from "@/components/ui/download-button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilterBar } from "@/components/report-filter-bar";
import {
  formatPeriodLabel,
  listReports,
  parseReportFilters,
  parseReportRange,
  type ReportFilters,
  type ReportRange,
} from "@/lib/services/reports";
import { listDocumentTypeViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";

function reportQuery(range: ReportRange, filters: ReportFilters) {
  const params = new URLSearchParams();
  if (range.fromLabel) params.set("from", range.fromLabel);
  if (range.toLabel) params.set("to", range.toLabel);
  if (filters.documentType) params.set("documentType", filters.documentType);
  if (filters.status) params.set("status", filters.status);
  return params.toString();
}

/** `key` is a report key, or `all` for the combined PDF. */
function pdfHref(key: string, range: ReportRange, filters: ReportFilters) {
  const query = reportQuery(range, filters);
  return query ? `/api/reports/${key}/pdf?${query}` : `/api/reports/${key}/pdf`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : undefined;
  const to = typeof params.to === "string" ? params.to : undefined;
  const range = parseReportRange(from, to);
  const periodLabel = formatPeriodLabel(range);
  const filters = parseReportFilters(
    typeof params.documentType === "string" ? params.documentType : undefined,
    typeof params.status === "string" ? params.status : undefined,
  );
  const documentTypes = (await listDocumentTypeViews())
    .filter((type) => type.isActive)
    .map((type) => type.name);
  const reports = await listReports(
    range,
    {
      "request-summary": parsePage(params["page-request-summary"]),
      "claimed-documents": parsePage(params["page-claimed-documents"]),
      "generated-certificates": parsePage(params["page-generated-certificates"]),
      "student-records": parsePage(params["page-student-records"]),
    },
    filters,
  );
  const pageQuery = Object.fromEntries(
    reports.map((report) => [`page-${report.key}`, report.page && report.page > 1 ? String(report.page) : undefined]),
  );

  return (
    <div>
      <SectionHeading
        title="Reports"
        description="Registrar reports for school document and certificate workflows. Pick a period and filters, then export one report or all of them as a single PDF."
        actions={
          <DownloadButton
            href={pdfHref("all", range, filters)}
            tone="info"
            loadingLabel="Preparing PDFs…"
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Export All PDF
          </DownloadButton>
        }
      />

      <Card className="mb-6">
        <CardContent>
          <ReportFilterBar
            initialFrom={range.fromLabel}
            initialTo={range.toLabel}
            initialDocumentType={filters.documentType}
            initialStatus={filters.status}
            periodLabel={periodLabel}
            documentTypes={documentTypes}
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
          const page = report.page ?? 1;
          const pageSize = report.pageSize ?? 20;

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
                <DownloadButton href={pdfHref(report.key, range, filters)} tone="info" loadingLabel="Preparing PDF…">
                  <FileDown className="h-4 w-4" aria-hidden />
                  Export PDF
                </DownloadButton>
              </div>

              <DataTable
                columns={columns}
                rows={report.rows}
                emptyMessage="No records match the selected filters."
              />
              <Pagination
                page={page}
                totalPages={Math.ceil(report.total / pageSize)}
                total={report.total}
                pageSize={pageSize}
                basePath="/registrar/reports"
                pageParam={`page-${report.key}`}
                query={{ from, to, documentType: filters.documentType, status: filters.status, ...pageQuery }}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
