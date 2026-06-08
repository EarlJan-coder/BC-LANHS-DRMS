import { FileBadge, UploadCloud } from "lucide-react";
import { DashboardCard } from "@/components/dashboard-card";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { getRegistrarDashboardData } from "@/lib/services/live-data";

export default async function RegistrarDashboardPage() {
  const { stats, requests, gradeImports } = await getRegistrarDashboardData();

  return (
    <div>
      <SectionHeading
        title="Registrar dashboard"
        description="Monitor request queues, document preparation, grade imports, and registrar audit activity."
        actions={
          <>
            <ButtonLink href="/registrar/grades/import" tone="secondary">
              <UploadCloud className="h-4 w-4" aria-hidden />
              Import grades
            </ButtonLink>
            <ButtonLink href="/registrar/certificates">
              <FileBadge className="h-4 w-4" aria-hidden />
              Certificates
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardCard key={stat.label} stat={stat} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <DataTable
          rows={requests}
          emptyMessage="No document requests have been submitted yet."
          columns={[
            { key: "tracking", label: "Tracking no.", render: (row) => row.trackingNumber },
            { key: "student", label: "Student", render: (row) => row.studentName },
            { key: "type", label: "Document", render: (row) => row.documentType },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
        <DataTable
          rows={gradeImports}
          emptyMessage="No grade import batches yet."
          columns={[
            { key: "batch", label: "Batch", render: (row) => row.batchNumber },
            { key: "rows", label: "Rows", render: (row) => `${row.importedRows}/${row.totalRows}` },
            { key: "status", label: "Status", render: (row) => row.status },
          ]}
        />
      </div>
    </div>
  );
}
