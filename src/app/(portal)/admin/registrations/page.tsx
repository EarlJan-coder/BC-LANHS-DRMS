import { DataTable } from "@/components/data-table";
import { RegistrationApproveActions } from "@/components/registration-approve-actions";
import { SectionHeading } from "@/components/section-heading";
import { listPendingRegistrations } from "@/lib/services/registrations";
import type { PendingRegistrationView } from "@/lib/types";

const columns = [
  { key: "name", label: "Name", render: (row: PendingRegistrationView) => row.name },
  { key: "lrn", label: "LRN", render: (row: PendingRegistrationView) => row.lrn },
  { key: "email", label: "Email", render: (row: PendingRegistrationView) => row.email },
  { key: "studentStatus", label: "Student status", render: (row: PendingRegistrationView) => row.studentStatus },
  { key: "schoolYear", label: "School year", render: (row: PendingRegistrationView) => row.schoolYear },
  { key: "actions", label: "Actions", render: () => null },
];

export default async function AdminRegistrationsPage() {
  const rows = await listPendingRegistrations();
  return (
    <div className="space-y-5">
      <SectionHeading title="Registrations on hold" description="Confirm each student's identity. Approval sends the student a sign-in link by email." />
      <DataTable title="Pending registrations" columns={columns}
        rows={rows}
        emptyMessage="No registrations awaiting review."
        renderRow={(row) => <RegistrationApproveActions key={row.id} registration={row} />}
      />
    </div>
  );
}
