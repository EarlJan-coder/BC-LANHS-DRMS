import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { SectionHeading } from "@/components/section-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { REQUEST_STATUSES } from "@/lib/constants";
import { listDocumentRequestViews } from "@/lib/services/live-data";

export default async function RegistrarRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; documentType?: string }>;
}) {
  const filters = await searchParams;
  const q = (filters.q ?? "").toLowerCase();
  const status = filters.status ?? "";
  const documentType = (filters.documentType ?? "").toLowerCase();
  const requests = (await listDocumentRequestViews()).filter((request) => {
    const matchesQuery =
      !q ||
      request.trackingNumber.toLowerCase().includes(q) ||
      request.studentName.toLowerCase().includes(q) ||
      (request.lrn ?? "").toLowerCase().includes(q) ||
      request.documentType.toLowerCase().includes(q);
    const matchesStatus = !status || request.status === status;
    const matchesDocument = !documentType || request.documentType.toLowerCase().includes(documentType);
    return matchesQuery && matchesStatus && matchesDocument;
  });

  return (
    <div>
      <SectionHeading
        title="Request management"
        description="Review, approve, reject, process, and mark school documents as ready or claimed."
      />
      <Card className="mb-5 p-4">
        <form className="grid gap-3 lg:grid-cols-[1fr_220px_240px_auto] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="q">Search</Label>
            <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Tracking, student, LRN, document" />
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
          <div className="grid gap-2">
            <Label htmlFor="documentType">Document type</Label>
            <Input id="documentType" name="documentType" defaultValue={filters.documentType ?? ""} placeholder="Certificate" />
          </div>
          <Button type="submit">Filter</Button>
        </form>
      </Card>
      <DataTable
        rows={requests}
        emptyMessage="No document requests have been submitted yet."
        columns={[
          {
            key: "tracking",
            label: "Tracking no.",
            render: (row) => (
              <Link href={`/registrar/requests/${row.id}`} prefetch={false} className="font-medium text-brand">
                {row.trackingNumber}
              </Link>
            ),
          },
          { key: "student", label: "Student", render: (row) => row.studentName },
          { key: "document", label: "Document", render: (row) => row.documentType },
          { key: "purpose", label: "Purpose", render: (row) => row.purpose },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "blockchain", label: "Chain", render: (row) => row.blockchainStatus },
        ]}
      />
    </div>
  );
}
