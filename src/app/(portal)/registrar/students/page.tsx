import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StudentRecordForm } from "@/components/student-record-form";
import { ButtonLink } from "@/components/ui/button";
import { getStudentRecordFormOptions, listStudentViews } from "@/lib/services/live-data";

export default async function StudentRecordsPage() {
  const [students, options] = await Promise.all([listStudentViews(), getStudentRecordFormOptions()]);

  return (
    <div>
      <SectionHeading
        title="Student records"
        description="Search and validate student and alumni records by LRN."
        actions={<ButtonLink href="/registrar/reports" tone="secondary">Export report</ButtonLink>}
      />
      <div className="mb-6">
        <StudentRecordForm gradeLevels={options.gradeLevels} sections={options.sections} />
      </div>
      <DataTable
        rows={students}
        emptyMessage="No student records found. Add records or import source data first."
        columns={[
          { key: "lrn", label: "LRN", render: (row) => row.lrn },
          {
            key: "name",
            label: "Name",
            render: (row) => (
              <Link href={`/registrar/students/${row.id}`} prefetch={false} className="font-medium text-brand">
                {row.name}
              </Link>
            ),
          },
          { key: "grade", label: "Grade level", render: (row) => row.gradeLevel },
          { key: "section", label: "Section", render: (row) => row.section },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
