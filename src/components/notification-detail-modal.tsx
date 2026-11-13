"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { UserRole } from "@/db/schema";

export type NotificationDetail = {
  kind: "request" | "certificate" | "registration" | "message";
  record: Record<string, unknown>;
};

export function NotificationDetailModal({
  detail,
  viewerRole,
  onClose,
  onDecisionComplete,
}: {
  detail: NotificationDetail | null;
  viewerRole: UserRole;
  onClose: () => void;
  onDecisionComplete: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!detail) return null;

  const record = detail.record;
  const notification = record.notification as Record<string, unknown> | undefined;
  const header = notification ?? record;
  const status = String(record.registrationStatus ?? "");
  const canReview = (viewerRole === "admin" || viewerRole === "registrar") && detail.kind === "registration" && (status === "pending" || status === "declined");

  async function decide(decision: "approved" | "declined") {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/registrations/${String(record.id)}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to review this registration.");
        return;
      }
      toast.success(decision === "approved" ? "Registration approved." : "Registration declined.");
      onDecisionComplete();
    } catch {
      toast.error("Unable to review this registration. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="notification-detail-title" className="w-full max-w-2xl rounded-lg border border-border bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="notification-detail-title" className="text-lg font-semibold text-slate-950">{String(header.title ?? "Notification details")}</h2>
            <p className="mt-1 text-sm text-slate-500">{String(header.message ?? "")}</p>
          </div>
          <Button type="button" tone="secondary" size="sm" onClick={onClose} disabled={busy}>Close</Button>
        </header>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
          {detail.kind === "request" ? (
            <>
              <Detail label="Tracking number" value={record.trackingNumber} />
              <Detail label="Student" value={record.studentName} />
              <Detail label="Document type" value={record.documentType} />
              <Detail label="Status" value={record.status} />
              <Detail label="Purpose" value={record.purpose} />
              <Detail label="School year" value={record.schoolYearNeeded} />
              <Detail label="Grade level" value={record.gradeLevelNeeded} />
              {record.strandNeeded ? <Detail label="Strand" value={record.strandNeeded} /> : null}
              <Detail label="Section" value={record.sectionNeeded} />
              <Detail label="Registrar remarks" value={record.registrarRemarks} />
            </>
          ) : null}
          {detail.kind === "certificate" ? (
            <>
              <Detail label="Certificate number" value={record.certificateNumber} />
              <Detail label="Certificate type" value={record.certificateType} />
              <Detail label="Student" value={record.studentName} />
              <Detail label="Generated" value={record.generatedAt} />
              <Detail label="Verification code" value={record.verificationCode} />
            </>
          ) : null}
          {detail.kind === "registration" ? (
            <>
              <Detail label="Student" value={record.name} />
              <Detail label="Email" value={record.email} />
              <Detail label="LRN" value={record.lrn} />
              <Detail label="Last school year attended" value={record.lastSchoolYearAttended} />
              <Detail
                label="Account"
                value={record.registrationStatus === "pending" ? "On hold" : record.registrationStatus}
              />
              <Detail label="Registered" value={record.createdAt} />
            </>
          ) : null}
          {detail.kind === "message" ? (
            <p className="text-sm text-slate-700 sm:col-span-2">{String(record.message ?? "No additional details are available.")}</p>
          ) : null}
        </div>

        {canReview ? (
          <div className="border-t border-border bg-slate-50 px-5 py-4">
            <label htmlFor="notification-registration-note" className="text-sm font-medium text-slate-700">Decision note sent by email</label>
            <Textarea id="notification-registration-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} className="mt-2" placeholder="Optional note for the student" />
            <div className="mt-3 flex justify-end gap-2">
              {status === "pending" ? <Button type="button" tone="danger" onClick={() => decide("declined")} loading={busy} disabled={busy}>Decline</Button> : null}
              <Button type="button" onClick={() => decide("approved")} loading={busy} disabled={busy}>{status === "declined" ? "Restore and approve" : "Approve"}</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: unknown }) {
  const text = value === null || value === undefined || value === "" ? "Not set" : String(value);
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-900">{text}</p>
    </div>
  );
}
