import { Clock, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { RetryBlockchainButton } from "@/components/retry-blockchain-button";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { getBlockchainAuditStats, listAuditTrailViews } from "@/lib/services/live-data";

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

export default async function BlockchainAuditTrailPage() {
  const [auditTrail, stats] = await Promise.all([listAuditTrailViews(), getBlockchainAuditStats()]);

  return (
    <div>
      <SectionHeading
        title="Blockchain audit trail"
        description="Verify local audit records against hash proofs submitted to the DocumentRequestAudit smart contract."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total records" value={stats.total} icon={ShieldCheck} tone="bg-slate-100 text-slate-600" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="bg-amber-100 text-amber-600" />
        <StatCard label="Submitted" value={stats.submitted} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-600" />
        <StatCard label="Failed" value={stats.failed} icon={XCircle} tone="bg-red-100 text-red-600" />
      </div>

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
