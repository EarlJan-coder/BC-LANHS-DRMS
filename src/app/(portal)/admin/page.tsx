import { Database, Download } from "lucide-react";
import { DashboardCard } from "@/components/dashboard-card";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { getAdminDashboardData } from "@/lib/services/live-data";

export default async function AdminDashboardPage() {
  const { stats, auditTrail } = await getAdminDashboardData();

  return (
    <div>
      <SectionHeading
        title="Admin dashboard"
        description="Manage users, school configuration, document types, backups, and blockchain audit visibility."
        actions={
          <>
            <ButtonLink href="/admin/settings" tone="secondary">
              <Database className="h-4 w-4" aria-hidden />
              Settings
            </ButtonLink>
            <ButtonLink href="/admin/blockchain">
              <Download className="h-4 w-4" aria-hidden />
              Audit trail
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <DashboardCard key={stat.label} stat={stat} />
        ))}
      </div>
      <div className="mt-6">
        <DataTable
          rows={auditTrail}
          emptyMessage="No audit records found yet."
          columns={[
            { key: "action", label: "Action", render: (row) => row.action },
            { key: "reference", label: "Reference", render: (row) => row.referenceId },
            { key: "role", label: "Actor role", render: (row) => row.actorRole },
            { key: "status", label: "Chain status", render: (row) => row.status },
            { key: "created", label: "Created", render: (row) => row.createdAt },
          ]}
        />
      </div>
    </div>
  );
}
