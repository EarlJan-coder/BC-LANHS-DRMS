import { DataTable } from "@/components/data-table";
import { RequestFilterForm } from "@/components/request-filter-form";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PendingLink } from "@/components/ui/pending-link";
import { listDocumentRequestViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";
import { REQUEST_STATUSES } from "@/lib/constants";
import type { RequestStatus } from "@/db/schema";

export default async function RegistrarRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; documentType?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const q = (filters.q ?? "").toLowerCase();
  const requestedStatus = filters.status ?? "";
  const status = REQUEST_STATUSES.some((item) => item.value === requestedStatus) ? requestedStatus as RequestStatus : "";
  const documentType = filters.documentType ?? "";
  const page = parsePage(filters.page);
  const paged = await listDocumentRequestViews({ page, q, status: status || undefined, documentType });

  return (
    <div>
      <SectionHeading
        title="Request management"
        description="Review, approve, reject, process, and mark school documents as ready or claimed."
      />
      <Card className="mb-5 p-4">
        <RequestFilterForm
          className="grid gap-3 lg:grid-cols-[1fr_220px_240px_auto] lg:items-end"
          queryPlaceholder="Tracking, student, LRN, document"
          showDocumentType
          initialQuery={filters.q ?? ""}
          initialStatus={status}
          initialDocumentType={filters.documentType ?? ""}
        />
      </Card>
      <DataTable
        rows={paged.rows}
        emptyMessage="No document requests have been submitted yet."
        columns={[
          {
            key: "tracking",
            label: "Tracking no.",
            render: (row) => (
              <PendingLink
                href={`/registrar/requests/${row.id}`}
                label={row.trackingNumber}
                className="font-medium text-brand"
              />
            ),
          },
          { key: "student", label: "Student", render: (row) => row.studentName },
          { key: "document", label: "Document", render: (row) => row.documentType },
          { key: "purpose", label: "Purpose", render: (row) => row.purpose },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "blockchain", label: "Chain", render: (row) => row.blockchainStatus },
        ]}
      />
      <Pagination page={paged.page} totalPages={Math.ceil(paged.total / paged.pageSize)} basePath="/registrar/requests" total={paged.total} pageSize={paged.pageSize} query={{ q: filters.q, status, documentType: filters.documentType }} />
    </div>
  );
}
