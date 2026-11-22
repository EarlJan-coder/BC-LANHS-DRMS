import { AddAccountForm } from "@/components/add-account-form";
import { DataTable } from "@/components/data-table";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SectionHeading } from "@/components/section-heading";
import { UserApprovalActions } from "@/components/user-approval-actions";
import { UserStatusActions } from "@/components/user-status-actions";
import { listUserViews } from "@/lib/services/live-data";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/pagination";
import { humanizeStatus, roleLabel } from "@/lib/utils";

const REGISTRATION_LABELS: Record<string, string> = {
  pending: "On hold",
  approved: "Approved",
  declined: "Declined",
};

export default async function UserManagementPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const users = await listUserViews({ page });

  return (
    <div>
      <SectionHeading
        title="User management"
        description="Review self-registered accounts and manage portal access. The administrator account is fixed."
      />
      <AddAccountForm />
      <DataTable
        rows={users.rows}
        emptyMessage="No registered accounts yet."
        columns={[
          { key: "name", label: "Name", render: (row) => row.name },
          { key: "email", label: "Email", render: (row) => row.email },
          { key: "role", label: "Role", render: (row) => roleLabel(row.role) },
          {
            key: "registrationStatus",
            label: "Registration",
            render: (row) => REGISTRATION_LABELS[row.registrationStatus] ?? row.registrationStatus,
          },
          { key: "status", label: "Status", render: (row) => humanizeStatus(row.status) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => {
              if (row.rawRole === "admin") {
                return <span className="text-sm text-slate-500">Administrator account</span>;
              }

              return (
                <div className="flex flex-col items-start gap-2">
                  <UserApprovalActions userId={row.id} registrationStatus={row.registrationStatus} />
                  <UserStatusActions userId={row.id} status={row.rawStatus} />
                  <ResetPasswordForm userId={row.id} email={row.email} />
                </div>
              );
            },
          },
        ]}
      />
      <Pagination page={users.page} totalPages={Math.ceil(users.total / users.pageSize)} basePath="/admin/users" total={users.total} pageSize={users.pageSize} />
    </div>
  );
}
