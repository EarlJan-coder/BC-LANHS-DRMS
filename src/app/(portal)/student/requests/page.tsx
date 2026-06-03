import { Eye, FileDown } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export default async function MyRequestsPage() {
  const requests = await listDocumentRequestViews({ currentUserOnly: true });

  return (
    <div>
      <SectionHeading
        title="My requests"
        description="Review submitted document requests, processing status, and generated slips."
        actions={<ButtonLink href="/student/requests/new">New request</ButtonLink>}
      />
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
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:text-brand"
                  aria-label="Download request slip"
                >
                  <FileDown className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
