import { AddAccountForm } from "@/components/add-account-form";
import { DataTable } from "@/components/data-table";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { UserApprovalActions } from "@/components/user-approval-actions";
import { UserStatusActions } from "@/components/user-status-actions";
import { UserDeleteAction } from "@/components/user-delete-action";
import { Pagination } from "@/components/ui/pagination";
import { ButtonLink } from "@/components/ui/button";
import { parsePage } from "@/lib/pagination";
import { getStudentRecordIdsByUserIds, listStudentViews, listUserViews } from "@/lib/services/live-data";
import { humanizeStatus, roleLabel } from "@/lib/utils";

const REGISTRATION_LABELS: Record<string, string> = {
  pending: "On hold",
  approved: "Approved",
  declined: "Declined",
};

function StatusPill({ value, kind }: { value: string; kind: "registration" | "account" | "enrollment" }) {
  const color = kind === "registration"
    ? value === "approved" ? "bg-emerald-50 text-emerald-800 ring-emerald-700/10"
      : value === "pending" ? "bg-amber-50 text-amber-800 ring-amber-700/10"
        : "bg-rose-50 text-rose-800 ring-rose-700/10"
    : kind === "enrollment"
      ? value === "enrolled" ? "bg-emerald-50 text-emerald-800 ring-emerald-700/10"
        : value === "alumni" ? "bg-blue-50 text-blue-800 ring-blue-700/10"
          : value === "transferred" ? "bg-amber-50 text-amber-800 ring-amber-700/10"
            : "bg-slate-100 text-slate-700 ring-slate-600/10"
      : value === "active" ? "bg-emerald-50 text-emerald-800 ring-emerald-700/10"
        : "bg-slate-100 text-slate-700 ring-slate-600/10";
  const label = kind === "registration"
    ? REGISTRATION_LABELS[value] ?? humanizeStatus(value)
    : humanizeStatus(value);

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${color}`}>{label}</span>;
}

export default async function UserManagementPage({ searchParams }: { searchParams: Promise<{ page?: string; studentPage?: string }> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const studentPage = parsePage(params.studentPage);
  const [users, students] = await Promise.all([
    listUserViews({ page }),
    listStudentViews({ page: studentPage }),
  ]);
  const studentIdsByUserId = await getStudentRecordIdsByUserIds(users.rows.filter((row) => row.rawRole === "student").map((row) => row.id));

  return (
    <div className="mx-auto max-w-[1500px] space-y-7 pb-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-sm font-medium text-slate-500">Administration</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]">User management</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
            Manage account access, review registrations, and open student records.
          </p>
        </div>
        <AddAccountForm />
      </header>

      <nav aria-label="User management sections" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-200 pb-3 text-sm">
        <a href="#accounts" className="font-semibold text-brand underline decoration-brand underline-offset-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Accounts <span className="ml-1 font-normal text-slate-500">{users.total.toLocaleString("en-US")}</span></a>
        <a href="#student-records" className="font-medium text-slate-600 underline decoration-transparent underline-offset-8 transition hover:text-brand hover:decoration-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Student records <span className="ml-1 font-normal text-slate-500">{students.total.toLocaleString("en-US")}</span></a>
      </nav>

      <section id="accounts" className="scroll-mt-24 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Accounts</h2>
            <p className="text-sm text-slate-500">Review sign-ups and manage access for staff and students.</p>
          </div>
          <p className="text-xs font-medium text-slate-400">The administrator account is fixed.</p>
        </div>
        <DataTable title="Registered accounts" rows={users.rows}
          emptyMessage="No registered accounts yet. Add an account to get started."
          columns={[
            { key: "name", label: "Name", render: (row) => <span className="font-medium text-slate-950">{row.name}</span> },
            { key: "email", label: "Email", render: (row) => <span className="text-slate-600">{row.email}</span> },
            { key: "role", label: "Role", render: (row) => <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{roleLabel(row.role)}</span> },
            {
              key: "registrationStatus",
              label: "Registration",
              render: (row) => <div className="flex min-w-40 flex-col items-start gap-2"><StatusPill kind="registration" value={row.registrationStatus} />{row.rawRole !== "admin" && row.registrationStatus === "pending" ? <UserApprovalActions userId={row.id} registrationStatus={row.registrationStatus} /> : null}</div>,
            },
            {
              key: "status",
              label: "Account status",
              render: (row) => row.rawRole === "admin"
                ? <div className="flex min-w-40 flex-col items-start gap-2"><StatusPill kind="account" value={row.status} /><span className="text-xs text-slate-400">Fixed account</span></div>
                : <UserStatusActions userId={row.id} status={row.rawStatus} />,
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => {
                if (row.rawRole === "admin") return <span className="text-sm text-slate-400">—</span>;
                if (row.rawRole === "student") {
                  const studentId = studentIdsByUserId.get(row.id);
                  return studentId
                    ? <ButtonLink href={`/admin/users/${studentId}`} tone="secondary" size="sm">View</ButtonLink>
                    : <span className="text-xs text-slate-500">No linked record</span>;
                }
                return <div className="flex min-w-40 items-center gap-2"><ResetPasswordForm userId={row.id} email={row.email} /><UserDeleteAction userId={row.id} /></div>;
              },
            },
          ]}
        />
        <Pagination page={users.page} totalPages={Math.ceil(users.total / users.pageSize)} basePath="/admin/users" total={users.total} pageSize={users.pageSize} query={{ studentPage: studentPage > 1 ? String(studentPage) : undefined }} />
      </section>

      <section id="student-records" className="scroll-mt-24 space-y-3 border-t border-slate-200 pt-7">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Student records</h2>
            <p className="text-sm text-slate-500">Find a student profile, then view its requests and certificates.</p>
          </div>
          <span className="text-sm text-slate-500">{students.total.toLocaleString("en-US")} {students.total === 1 ? "student" : "students"}</span>
        </div>
        <DataTable title="Student records" rows={students.rows}
          emptyMessage="No student records found. Students can register from the sign-up page."
          columns={[
            { key: "lrn", label: "LRN", render: (row) => <span className="font-mono text-xs font-medium text-slate-700">{row.lrn}</span> },
            { key: "name", label: "Name", render: (row) => <span className="font-medium text-slate-950">{row.name}</span> },
            { key: "email", label: "Email", render: (row) => row.email || <span className="text-slate-400">Not set</span> },
            { key: "phone", label: "Phone", render: (row) => row.phone || <span className="text-slate-400">Not set</span> },
            { key: "account", label: "Registration", render: (row) => <StatusPill kind="registration" value={row.registrationStatus} /> },
            { key: "status", label: "Enrollment", render: (row) => <StatusPill kind="enrollment" value={row.status} /> },
            { key: "view", label: "Actions", render: (row) => <ButtonLink href={`/admin/users/${row.id}`} tone="secondary" size="sm">View</ButtonLink> },
          ]}
        />
        <Pagination page={students.page} totalPages={Math.ceil(students.total / students.pageSize)} basePath="/admin/users" pageParam="studentPage" total={students.total} pageSize={students.pageSize} query={{ page: page > 1 ? String(page) : undefined }} />
      </section>
    </div>
  );
}
