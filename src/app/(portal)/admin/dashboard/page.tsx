import { DashboardCard } from "@/components/dashboard-card";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { getAdminDashboardData } from "@/lib/services/live-data";
import { humanizeStatus, roleLabel } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const { stats, auditTrail } = await getAdminDashboardData();

  return (
    <div>
      <SectionHeading
        title="Admin dashboard"
        description="Manage users, school configuration, backups, and blockchain audit visibility."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map((stat) => (
          <DashboardCard key={stat.label} stat={stat} />
        ))}
      </div>
      <div className="mt-6">
        <DataTable title="Audit activity" rows={auditTrail}
          emptyMessage="No audit records found yet."
          columns={[
            { key: "action", label: "Action", render: (row) => row.action },
            { key: "reference", label: "Reference", render: (row) => row.referenceId },
            { key: "role", label: "Role", render: (row) => roleLabel(row.actorRole) },
            { key: "status", label: "Chain status", render: (row) => humanizeStatus(row.status) },
            { key: "created", label: "Created", render: (row) => row.createdAt },
          ]}
        />
      </div>
    </div>
  );
}
