import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { listStudentGradeSummaryViews } from "@/lib/services/live-data";

export default async function GradeManagementPage() {
  const studentRows = await listStudentGradeSummaryViews();

  return (
    <div>
      <SectionHeading
        title="Grade management"
        description="View students with grade records. Click a student to see all their grades, requests, and certificates."
        actions={
          <ButtonLink href="/registrar/grades/import">
            <BookOpenCheck className="h-4 w-4" aria-hidden />
            Bulk import
          </ButtonLink>
        }
      />
      <DataTable
        rows={studentRows}
        emptyMessage="No students with grade records found. Use bulk import to save real grade rows."
        columns={[
          { key: "lrn", label: "LRN", render: (row) => row.lrn },
          {
            key: "name",
            label: "Student",
            render: (row) => (
              <Link href={`/registrar/students/${row.id}`} prefetch={false} className="font-medium text-brand">
                {row.name}
              </Link>
            ),
          },
          { key: "gradeLevel", label: "Grade level", render: (row) => row.gradeLevel },
          { key: "section", label: "Section", render: (row) => row.section },
          { key: "subjectCount", label: "Subjects", render: (row) => row.subjectCount.toString() },
          { key: "averageFinalGrade", label: "Avg. final grade", render: (row) => row.averageFinalGrade },
          { key: "latestSchoolYear", label: "Latest school year", render: (row) => row.latestSchoolYear },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
