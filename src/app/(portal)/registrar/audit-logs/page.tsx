import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listAuditTrailViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";

export default async function RegistrarAuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const auditTrail = await listAuditTrailViews({ page });

  return (
    <div>
      <SectionHeading
        title="Audit logs"
        description="Important registrar actions are recorded locally and mirrored to blockchain audit proofs when configured."
      />
      <DataTable
        rows={auditTrail.rows}
        emptyMessage="No audit records found yet."
        columns={[
          { key: "action", label: "Action", render: (row) => row.action },
          { key: "reference", label: "Reference", render: (row) => row.referenceId },
          { key: "role", label: "Actor role", render: (row) => row.actorRole },
          { key: "hash", label: "Record hash", render: (row) => <span className="font-mono text-xs">{row.hash.slice(0, 18)}...</span> },
          { key: "status", label: "Chain status", render: (row) => row.status },
          { key: "created", label: "Created", render: (row) => row.createdAt },
        ]}
      />
      <Pagination page={auditTrail.page} totalPages={Math.ceil(auditTrail.total / auditTrail.pageSize)} basePath="/registrar/audit-logs" total={auditTrail.total} pageSize={auditTrail.pageSize} />
    </div>
  );
}
