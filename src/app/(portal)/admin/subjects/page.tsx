import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { listSubjectViews } from "@/lib/services/live-data";

export default async function SubjectManagementPage() {
  const rows = await listSubjectViews();

  return (
    <div>
      <SectionHeading title="Subject management" description="Subjects used by grade import matching and certificate generation." />
      <DataTable
        rows={rows}
        emptyMessage="No subjects configured yet."
        columns={[
          { key: "code", label: "Code", render: (row) => row.code },
          { key: "name", label: "Subject", render: (row) => row.name },
          { key: "level", label: "Grade level", render: (row) => row.gradeLevel },
        ]}
      />
    </div>
  );
}
