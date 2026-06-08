import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listSectionViews } from "@/lib/services/live-data";

export default async function AdminSectionsPage() {
  const sections = await listSectionViews();

  return (
    <div>
      <SectionHeading title="Sections" description="Manage section assignments by grade level and school year." />
      <DataTable
        rows={sections}
        emptyMessage="No sections found."
        columns={[
          { key: "name", label: "Section", render: (row) => row.name },
          { key: "grade", label: "Grade level", render: (row) => row.gradeLevel },
          { key: "year", label: "School year", render: (row) => row.schoolYear },
          { key: "adviser", label: "Adviser", render: (row) => row.adviserName },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
