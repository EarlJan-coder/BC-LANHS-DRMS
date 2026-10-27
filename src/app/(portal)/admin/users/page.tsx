import { AddAccountForm } from "@/components/add-account-form";
import { DataTable } from "@/components/data-table";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SectionHeading } from "@/components/section-heading";
import { UserRoleActions } from "@/components/user-role-actions";
import { listUserViews } from "@/lib/services/live-data";

export default async function UserManagementPage() {
  const users = await listUserViews();

  return (
    <div>
      <SectionHeading
        title="User management"
        description="Manage registered portal accounts and their role assignments."
      />
      <AddAccountForm />
      <DataTable
        rows={users}
        emptyMessage="No registered accounts yet."
        columns={[
          { key: "name", label: "Name", render: (row) => row.name },
          { key: "email", label: "Email", render: (row) => row.email },
          { key: "role", label: "Role", render: (row) => row.role },
          { key: "status", label: "Status", render: (row) => row.status },
          {
            key: "actions",
            label: "Role / status",
            render: (row) => (
              <div className="flex flex-col items-start gap-2">
                <UserRoleActions userId={row.id} role={row.rawRole} status={row.rawStatus} />
                <ResetPasswordForm userId={row.id} email={row.email} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
