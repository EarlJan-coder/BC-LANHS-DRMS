import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listGradeLevelViews } from "@/lib/services/live-data";

export default async function GradeLevelSectionPage() {
  const rows = await listGradeLevelViews();

  return (
    <div>
      <SectionHeading title="Grade level and section management" description="Maintain grade levels, sections, and adviser assignments." />
      <DataTable
        rows={rows}
        emptyMessage="No grade levels configured yet."
        columns={[
          { key: "level", label: "Grade level", render: (row) => row.gradeLevel },
          { key: "sections", label: "Sections", render: (row) => row.sections },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
