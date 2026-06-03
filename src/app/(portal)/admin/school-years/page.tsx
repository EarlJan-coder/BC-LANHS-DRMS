import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listSchoolYearViews } from "@/lib/services/live-data";

export default async function SchoolYearSettingsPage() {
  const rows = await listSchoolYearViews();

  return (
    <div>
      <SectionHeading title="School year settings" description="Manage active academic years used by requests and grades." />
      <DataTable
        rows={rows}
        emptyMessage="No school years configured yet."
        columns={[
          { key: "name", label: "School year", render: (row) => row.name },
          { key: "start", label: "Start", render: (row) => row.startsOn },
          { key: "end", label: "End", render: (row) => row.endsOn },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
