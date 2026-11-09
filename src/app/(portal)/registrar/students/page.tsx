import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { PendingLink } from "@/components/ui/pending-link";
import { StudentRecordModal } from "@/components/student-record-modal";
import { ButtonLink } from "@/components/ui/button";
import { listStudentViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";

export default async function StudentRecordsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const students = await listStudentViews({ page });

  return (
    <div>
      <SectionHeading
        title="Student records"
        description="Review student accounts and records by LRN."
        actions={
          <ButtonLink href="/registrar/reports" tone="secondary">Export report</ButtonLink>
        }
      />
      <DataTable
        rows={students.rows}
        emptyMessage="No student records found. Students can register from the sign-up page."
        columns={[
          { key: "lrn", label: "LRN", render: (row) => row.lrn },
          {
            key: "name",
            label: "Name",
            render: (row) => (
              <PendingLink
                href={`/registrar/students/${row.id}`}
                label={row.name}
                className="font-medium text-brand"
              />
            ),
          },
          { key: "email", label: "Email", render: (row) => row.email || "Not set" },
          { key: "phone", label: "Phone", render: (row) => row.phone || "Not set" },
          { key: "account", label: "Account", render: (row) => row.registrationStatus[0].toUpperCase() + row.registrationStatus.slice(1) },
          { key: "status", label: "Status", render: (row) => row.status },
          {
            key: "view",
            label: "View",
            render: (row) => <StudentRecordModal student={row} />,
          },
        ]}
      />
      <Pagination page={students.page} totalPages={Math.ceil(students.total / students.pageSize)} basePath="/registrar/students" total={students.total} pageSize={students.pageSize} />
    </div>
  );
}
