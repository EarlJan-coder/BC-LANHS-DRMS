import { Eye, FileDown } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { ButtonLink } from "@/components/ui/button";
import { REQUEST_STATUSES } from "@/lib/constants";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export default async function MyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const q = (filters.q ?? "").toLowerCase();
  const status = filters.status ?? "";
  const requests = (await listDocumentRequestViews({ currentUserOnly: true })).filter((request) => {
    const matchesQuery =
      !q ||
      request.trackingNumber.toLowerCase().includes(q) ||
      request.documentType.toLowerCase().includes(q) ||
      request.purpose.toLowerCase().includes(q);
    const matchesStatus = !status || request.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div>
      <SectionHeading
        title="My requests"
        description="Review submitted document requests, processing status, and generated slips."
        actions={<ButtonLink href="/student/requests/new">New request</ButtonLink>}
      />
      <Card className="mb-5 p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="q">Search</Label>
            <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Tracking number, document, purpose" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {REQUEST_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Filter</Button>
        </form>
      </Card>
      <DataTable
        rows={requests}
        emptyMessage="You have not submitted a document request yet."
        columns={[
          {
            key: "tracking",
            label: "Tracking no.",
            render: (row) => (
              <Link href={`/student/requests/${row.id}`} prefetch={false} className="font-medium text-brand">
                {row.trackingNumber}
              </Link>
            ),
          },
          { key: "type", label: "Document", render: (row) => row.documentType },
          { key: "purpose", label: "Purpose", render: (row) => row.purpose },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "requested", label: "Requested", render: (row) => row.requestedAt },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <Link
                  href={`/student/requests/${row.id}`}
                  prefetch={false}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:text-brand"
                  aria-label="View request"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <a
                  href={`/api/document-requests/${row.id}/slip`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:text-brand"
                  aria-label="Download request slip"
                >
                  <FileDown className="h-4 w-4" />
                </a>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
