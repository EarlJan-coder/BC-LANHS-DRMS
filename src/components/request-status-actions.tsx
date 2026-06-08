"use client";

import { Ban, Check, ClipboardCheck, PackageCheck, RotateCw, SearchCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RequestStatus } from "@/db/schema";

const actions: Array<{ status: RequestStatus; label: string; icon: typeof Check; confirm: string }> = [
  { status: "under_review", label: "Review", icon: SearchCheck, confirm: "Mark this request as under review?" },
  { status: "approved", label: "Approve", icon: Check, confirm: "Approve this document request?" },
  { status: "rejected", label: "Reject", icon: X, confirm: "Reject this document request?" },
  { status: "processing", label: "Process", icon: RotateCw, confirm: "Mark this request as processing?" },
  { status: "ready_for_pickup", label: "Ready", icon: PackageCheck, confirm: "Mark this document as ready for pickup?" },
  { status: "claimed", label: "Claimed", icon: ClipboardCheck, confirm: "Mark this document as claimed?" },
  { status: "cancelled", label: "Cancel", icon: Ban, confirm: "Cancel this document request?" },
];

export function RequestStatusActions({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState<RequestStatus | null>(null);

  async function updateStatus(status: RequestStatus, confirmText: string) {
    if (!window.confirm(confirmText)) {
      return;
    }

    const rejectionReason =
      status === "rejected" ? window.prompt("Enter rejection reason", "Registrar rejected this request after validation.") : null;

    setLoading(status);
    const response = await fetch(`/api/document-requests/${requestId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        remarks: `Status updated to ${status}.`,
        registrarRemarks: `Registrar marked this request as ${status.replaceAll("_", " ")}.`,
        rejectionReason: status === "rejected" ? rejectionReason : undefined,
      }),
    });
    const data = await response.json();
    setLoading(null);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to update status.");
      return;
    }

    toast.success("Request status updated.");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <Button
            key={action.status}
            type="button"
            tone={action.status === "rejected" ? "danger" : "secondary"}
            onClick={() => updateStatus(action.status, action.confirm)}
            disabled={loading !== null}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {loading === action.status ? "Saving" : action.label}
          </Button>
        );
      })}
    </div>
  );
}
