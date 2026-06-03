import { BookOpenCheck } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { listGradeRecordViews } from "@/lib/services/live-data";

export default async function GradeManagementPage() {
  const gradeRows = await listGradeRecordViews();

  return (
    <div>
      <SectionHeading
        title="Grade management"
        description="Manage saved grade records and generate Certificate of Grades from validated rows."
        actions={
          <ButtonLink href="/registrar/grades/import">
            <BookOpenCheck className="h-4 w-4" aria-hidden />
            Bulk import
          </ButtonLink>
        }
      />
      <DataTable
        rows={gradeRows}
        emptyMessage="No grade records found. Use bulk import to save real grade rows."
        columns={[
          { key: "student", label: "Student", render: (row) => row.studentName },
          { key: "subject", label: "Subject", render: (row) => row.subject },
          { key: "schoolYear", label: "School year", render: (row) => row.schoolYear },
          { key: "finalGrade", label: "Final grade", render: (row) => row.finalGrade },
          { key: "remarks", label: "Remarks", render: (row) => row.remarks },
        ]}
      />
    </div>
  );
}
