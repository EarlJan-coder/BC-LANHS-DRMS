"use client";

import { useState } from "react";
import { GenerateCertificateButton } from "@/components/generate-certificate-button";
import { RequestStatusActions } from "@/components/request-status-actions";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RequestStatus } from "@/db/schema";
import type { DocumentRequestView } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  fromStatus: string;
  toStatus: string;
  remarks: string;
  actorUserName: string;
  createdAt: string;
}

export function RegistrarRequestDetailsView({
  request,
  initialTimeline,
}: {
  request: DocumentRequestView;
  initialTimeline: TimelineItem[];
}) {
  const [override, setOverride] = useState<{
    status?: RequestStatus;
    remarks?: string;
    updatedAt?: string;
    newTimelineItems?: TimelineItem[];
  }>({});

  const currentStatus = override.status ?? request.status;
  const currentRegistrarRemarks = override.remarks ?? request.registrarRemarks;
  const currentUpdatedAt = override.updatedAt ?? request.updatedAt;
  const timeline = [...(override.newTimelineItems ?? []), ...initialTimeline];

  function handleStatusChange(newStatus: RequestStatus, newRemarks: string) {
    const prevStatus = currentStatus;
    const newEntry: TimelineItem = {
      id: `temp-${Date.now()}`,
      fromStatus: prevStatus,
      toStatus: newStatus,
      remarks: newRemarks,
      actorUserName: "Registrar",
      createdAt: formatDateTime(new Date()),
    };

    setOverride((prev) => ({
      status: newStatus,
      remarks: newRemarks,
      updatedAt: formatDate(new Date()),
      newTimelineItems: [newEntry, ...(prev.newTimelineItems ?? [])],
    }));
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{request.documentType}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Student" value={request.studentName} />
              <Detail label="LRN" value={request.lrn ?? "Not linked"} />
              <Detail label="Status" value={<StatusBadge status={currentStatus} />} />
              <Detail label="School year needed" value={request.schoolYearNeeded} />
              <Detail label="Grade level needed" value={request.gradeLevelNeeded} />
              <Detail label="Requested" value={request.requestedAt} />
              <Detail label="Updated" value={currentUpdatedAt} />
            </div>
            <Detail label="Purpose" value={request.purpose} />
            <Detail label="Student remarks" value={request.remarks} />
            <Detail label="Registrar remarks" value={currentRegistrarRemarks} />
            <RequestStatusActions
              requestId={request.id}
              currentStatus={currentStatus}
              onStatusChange={handleStatusChange}
            />
            <GenerateCertificateButton requestId={request.id} documentType={request.documentType} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit proof</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600">
            <Detail label="Blockchain status" value={request.blockchainStatus} />
            <Detail label="On-chain data" value="referenceId, action, actorRole, recordHash, timestamp" />
            <p className="rounded-md bg-rose-50 p-3 text-brand">
              Student details, grades, LRN, email, and documents are never stored on-chain.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Status timeline</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">No status changes recorded yet.</p>
          ) : (
            timeline.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4">
                <p className="text-sm font-semibold text-slate-950">
                  {String(item.fromStatus).replaceAll("_", " ")} {"->"} {String(item.toStatus).replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.remarks}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.createdAt} by {item.actorUserName}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-900">{value}</div>
    </div>
  );
}
