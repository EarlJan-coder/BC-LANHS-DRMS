import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export default async function RegistrarRequestsPage() {
  const requests = await listDocumentRequestViews();

  return (
    <div>
      <SectionHeading
        title="Request management"
        description="Review, approve, reject, process, and mark school documents as ready or claimed."
      />
      <DataTable
        rows={requests}
        emptyMessage="No document requests have been submitted yet."
        columns={[
          {
            key: "tracking",
            label: "Tracking no.",
            render: (row) => (
              <Link href={`/registrar/requests/${row.id}`} prefetch={false} className="font-medium text-brand">
                {row.trackingNumber}
              </Link>
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
