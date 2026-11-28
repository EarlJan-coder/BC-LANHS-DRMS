import { Clock, CheckCircle2, Download, XCircle, ShieldCheck } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { RetryBlockchainButton } from "@/components/retry-blockchain-button";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { DownloadButton } from "@/components/ui/download-button";
import { getBlockchainAuditStats, listAuditTrailViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";
import { humanizeStatus, roleLabel } from "@/lib/utils";

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

export default async function BlockchainAuditTrailPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const [auditTrail, stats] = await Promise.all([listAuditTrailViews({ page }), getBlockchainAuditStats()]);

  return (
    <div>
      <SectionHeading
        title="Blockchain audit trail"
        description="Verify local audit records against hash proofs submitted to the DocumentRequestAudit smart contract."
        actions={
          <DownloadButton href="/api/admin/blockchain/pdf" filename="lanhs-audit-trail.pdf" loadingLabel="Preparing PDF…">
            <Download className="h-4 w-4" aria-hidden />
            Download audit trail
          </DownloadButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total records" value={stats.total} icon={ShieldCheck} tone="bg-slate-100 text-slate-600" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="bg-amber-100 text-amber-600" />
        <StatCard label="Submitted" value={stats.submitted} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-600" />
        <StatCard label="Failed" value={stats.failed} icon={XCircle} tone="bg-red-100 text-red-900" />
      </div>

      <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
          <p className="text-sm text-slate-600">Only non-sensitive reference data and hashes are stored on-chain.</p>
        </div>
        <RetryBlockchainButton />
      </Card>
      <DataTable title="Audit records" rows={auditTrail.rows}
        emptyMessage="No blockchain audit records found yet."
        columns={[
          { key: "reference", label: "Reference", render: (row) => row.referenceId },
          { key: "action", label: "Action", render: (row) => row.action },
          { key: "role", label: "Role", render: (row) => roleLabel(row.actorRole) },
          { key: "hash", label: "Record hash", render: (row) => <span className="font-mono text-xs">{row.hash}</span> },
          { key: "status", label: "Status", render: (row) => humanizeStatus(row.status) },
          { key: "tx", label: "Transaction", render: (row) => <span className="font-mono text-xs">{row.transactionHash}</span> },
        ]}
      />
      <Pagination page={auditTrail.page} totalPages={Math.ceil(auditTrail.total / auditTrail.pageSize)} basePath="/admin/blockchain" total={auditTrail.total} pageSize={auditTrail.pageSize} />
    </div>
  );
}
