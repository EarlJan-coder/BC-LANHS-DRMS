import { DataTable } from "@/components/data-table";
import { RequestFilterForm } from "@/components/request-filter-form";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PendingLink } from "@/components/ui/pending-link";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export default async function RegistrarRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; documentType?: string }>;
}) {
  const filters = await searchParams;
  const q = (filters.q ?? "").toLowerCase();
  const status = filters.status ?? "";
  const documentType = (filters.documentType ?? "").toLowerCase();
  const requests = (await listDocumentRequestViews()).filter((request) => {
    const matchesQuery =
      !q ||
      request.trackingNumber.toLowerCase().includes(q) ||
      request.studentName.toLowerCase().includes(q) ||
      (request.lrn ?? "").toLowerCase().includes(q) ||
      request.documentType.toLowerCase().includes(q);
    const matchesStatus = !status || request.status === status;
    const matchesDocument = !documentType || request.documentType.toLowerCase().includes(documentType);
    return matchesQuery && matchesStatus && matchesDocument;
  });

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
        rows={requests}
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
    </div>
  );
}
