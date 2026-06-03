import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listAuditTrailViews } from "@/lib/services/live-data";

export default async function RegistrarAuditLogsPage() {
  const auditTrail = await listAuditTrailViews();

  return (
    <div>
      <SectionHeading
        title="Audit logs"
        description="Important registrar actions are recorded locally and mirrored to blockchain audit proofs when configured."
      />
      <DataTable
        rows={auditTrail}
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
    </div>
  );
}
