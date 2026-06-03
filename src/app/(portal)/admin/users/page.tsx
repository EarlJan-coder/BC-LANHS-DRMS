import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { listUserViews } from "@/lib/services/live-data";

export default async function UserManagementPage() {
  const users = await listUserViews();

  return (
    <div>
      <SectionHeading
        title="User management"
        description="Manage Clerk-linked application users and local role assignments."
        actions={<ButtonLink href="/admin/roles" tone="secondary">Manage roles</ButtonLink>}
      />
      <DataTable
        rows={users}
        emptyMessage="No users found yet. Sign in once or seed initial users."
        columns={[
          { key: "name", label: "Name", render: (row) => row.name },
          { key: "email", label: "Email", render: (row) => row.email },
          { key: "role", label: "Role", render: (row) => row.role },
          { key: "status", label: "Status", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
