import { Eye, FileDown } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { RequestFilterForm } from "@/components/request-filter-form";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/ui/download-button";
import { PendingLink } from "@/components/ui/pending-link";
import { listDocumentRequestViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";
import { REQUEST_STATUSES } from "@/lib/constants";
import type { RequestStatus } from "@/db/schema";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const q = (filters.q ?? "").toLowerCase();
  const requestedStatus = filters.status ?? "";
  const status = REQUEST_STATUSES.some((item) => item.value === requestedStatus) ? requestedStatus as RequestStatus : "";
  const page = parsePage(filters.page);
  const paged = await listDocumentRequestViews({ currentUserOnly: true, page, q, status: status || undefined });

  return (
    <div>
      <SectionHeading
        title="My requests"
        description="Review submitted document requests, processing status, and generated slips."
        actions={<ButtonLink href="/student/requests/new">New request</ButtonLink>}
      />
      <Card className="mb-5 p-4">
        <RequestFilterForm
          className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end"
          queryPlaceholder="Tracking number, document, purpose"
          initialQuery={filters.q ?? ""}
          initialStatus={status}
        />
      </Card>
      <DataTable
        rows={paged.rows}
        emptyMessage="You have not submitted a document request yet."
        columns={[
          {
            key: "tracking",
            label: "Tracking no.",
            render: (row) => (
              <PendingLink
                href={`/student/requests/${row.id}`}
                label={row.trackingNumber}
                className="font-medium text-brand"
              />
            ),
          },
          { key: "type", label: "Document", render: (row) => row.documentType },
          { key: "purpose", label: "Purpose", render: (row) => row.purpose },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "requested", label: "Requested", render: (row) => row.requestedAt },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <PendingLink
                  href={`/student/requests/${row.id}`}
                  label="View request"
                  iconOnly
                  icon={<Eye className="h-4 w-4" />}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:text-brand"
                />
                <DownloadButton
                  href={`/api/document-requests/${row.id}/slip`}
                  tone="secondary"
                  size="icon"
                  className="h-9 w-9 border-border bg-transparent text-slate-600 hover:bg-transparent hover:text-brand"
                  aria-label="Download request slip"
                >
                  <FileDown className="h-4 w-4" />
                </DownloadButton>
              </div>
            ),
          },
        ]}
      />
      <Pagination page={paged.page} totalPages={Math.ceil(paged.total / paged.pageSize)} basePath="/student/requests" total={paged.total} pageSize={paged.pageSize} query={{ q: filters.q, status }} />
    </div>
  );
}
