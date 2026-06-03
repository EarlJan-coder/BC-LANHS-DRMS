import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listDocumentTypeViews } from "@/lib/services/live-data";

export default async function DocumentTypeManagementPage() {
  const rows = await listDocumentTypeViews();

  return (
    <div>
      <SectionHeading title="Document type management" description="Configure supported school document request types." />
      <DataTable
        rows={rows}
        emptyMessage="No document types found. Run npm run db:seed or add document types."
        columns={[
          { key: "name", label: "Name", render: (row) => row.name },
          { key: "code", label: "Code", render: (row) => row.code },
          { key: "days", label: "Processing days", render: (row) => row.processingDays },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
