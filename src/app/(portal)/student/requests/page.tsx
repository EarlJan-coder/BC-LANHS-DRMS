import { Eye, FileDown } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { RequestFilterForm } from "@/components/request-filter-form";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/ui/download-button";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const q = (filters.q ?? "").toLowerCase();
  const status = filters.status ?? "";
  const requests = (await listDocumentRequestViews({ currentUserOnly: true })).filter((request) => {
    const matchesQuery =
      !q ||
      request.trackingNumber.toLowerCase().includes(q) ||
      request.documentType.toLowerCase().includes(q) ||
      request.purpose.toLowerCase().includes(q);
    const matchesStatus = !status || request.status === status;
    return matchesQuery && matchesStatus;
  });

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
        rows={requests}
        emptyMessage="You have not submitted a document request yet."
        columns={[
          {
            key: "tracking",
            label: "Tracking no.",
            render: (row) => (
              <Link href={`/student/requests/${row.id}`} prefetch={false} className="font-medium text-brand">
                {row.trackingNumber}
              </Link>
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
                <Link
                  href={`/student/requests/${row.id}`}
                  prefetch={false}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:text-brand"
                  aria-label="View request"
                >
                  <Eye className="h-4 w-4" />
                </Link>
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
    </div>
  );
}
