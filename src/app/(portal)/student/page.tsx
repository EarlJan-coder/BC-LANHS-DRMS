import { Bell, Download, FileText } from "lucide-react";
import { DashboardCard } from "@/components/dashboard-card";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentDashboardData } from "@/lib/services/live-data";

export default async function StudentDashboardPage() {
  const { stats, requests, notifications } = await getStudentDashboardData();

  return (
    <div>
      <SectionHeading
        title="Student dashboard"
        description="Track document requests, notifications, and generated request slips."
        actions={
          <ButtonLink href="/student/requests/new">
            <FileText className="h-4 w-4" aria-hidden />
            Submit request
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <DataTable
          rows={requests}
          emptyMessage="You have not submitted a document request yet."
          columns={[
            { key: "tracking", label: "Tracking no.", render: (row) => row.trackingNumber },
            { key: "type", label: "Document", render: (row) => row.documentType },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "updated", label: "Updated", render: (row) => row.updatedAt },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {notifications.length === 0 ? (
              <p className="rounded-md border border-border p-3 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="flex gap-3 rounded-md border border-border p-3">
                  <Bell className="mt-0.5 h-4 w-4 text-brand" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{notification.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                  </div>
                </div>
              ))
            )}
            <ButtonLink href="/student/requests" tone="secondary">
              <Download className="h-4 w-4" aria-hidden />
              View request slips
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
