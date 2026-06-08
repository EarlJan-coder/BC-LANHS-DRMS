import { ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { RetryBlockchainButton } from "@/components/retry-blockchain-button";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { listAuditTrailViews } from "@/lib/services/live-data";

export default async function BlockchainAuditTrailPage() {
  const auditTrail = await listAuditTrailViews();

  return (
    <div>
      <SectionHeading
        title="Blockchain audit trail"
        description="Verify local audit records against hash proofs submitted to the DocumentRequestAudit smart contract."
      />
      <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
          <p className="text-sm text-slate-600">Only non-sensitive reference data and hashes are stored on-chain.</p>
        </div>
        <RetryBlockchainButton />
      </Card>
      <DataTable
        rows={auditTrail}
        emptyMessage="No blockchain audit records found yet."
        columns={[
          { key: "reference", label: "Reference", render: (row) => row.referenceId },
          { key: "action", label: "Action", render: (row) => row.action },
          { key: "role", label: "Actor role", render: (row) => row.actorRole },
          { key: "hash", label: "Record hash", render: (row) => <span className="font-mono text-xs">{row.hash}</span> },
          { key: "status", label: "Status", render: (row) => row.status },
          { key: "tx", label: "Transaction", render: (row) => <span className="font-mono text-xs">{row.transactionHash}</span> },
        ]}
      />
    </div>
  );
}
