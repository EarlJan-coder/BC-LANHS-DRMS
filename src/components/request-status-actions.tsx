"use client";

import { Check, ClipboardCheck, PackageCheck, RotateCw, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { RequestStatus } from "@/db/schema";
import { REQUEST_ACTIONS, buildStatusUpdatePayload, type StatusColor } from "@/lib/request-actions";
import { cn } from "@/lib/utils";

const icons: Record<RequestStatus, LucideIcon> = {
  approved: Check,
  rejected: X,
  processing: RotateCw,
  ready_for_pickup: PackageCheck,
  claimed: ClipboardCheck,
} as Record<RequestStatus, LucideIcon>;

/** Highlight classes for the button matching the request's current status. */
const activeColors: Record<StatusColor, string> = {
  green: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-emerald-600",
  red: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600",
  amber: "bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus-visible:outline-amber-600",
  blue: "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:outline-blue-600",
  purple: "bg-violet-600 text-white shadow-sm hover:bg-violet-700 focus-visible:outline-violet-600",
};

export function RequestStatusActions({
  requestId,
  currentStatus,
  onStatusChange,
}: {
  requestId: string;
  currentStatus?: RequestStatus;
  onStatusChange?: (newStatus: RequestStatus, remarks: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<RequestStatus | null>(null);
  const [pendingAction, setPendingAction] = useState<(typeof REQUEST_ACTIONS)[number] | null>(null);

  async function submitStatus(status: RequestStatus, rejectionReason?: string) {
    const payload = buildStatusUpdatePayload(status, rejectionReason);
    if (!payload) {
      toast.error("Enter a rejection reason.");
      return;
    }

    setLoading(status);
    try {
      const response = await fetch(`/api/document-requests/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to update status.");
        return;
      }

      toast.success("Request status updated.");
      setPendingAction(null);
      onStatusChange?.(status, payload.registrarRemarks);
      router.refresh();
    } catch {
      toast.error("Unable to update status. Check your connection and try again.");
    } finally {
      setLoading(null);
    }
  }

  function confirmAction(reason?: string) {
    if (!pendingAction) {
      return;
    }
    void submitStatus(pendingAction.status, pendingAction.status === "rejected" ? reason : undefined);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {REQUEST_ACTIONS.map((action) => {
          const Icon = icons[action.status];
          const isActive = currentStatus === action.status;

          return (
            <Button
              key={action.status}
              type="button"
              tone={isActive ? "primary" : "secondary"}
              className={cn(isActive && activeColors[action.color])}
              onClick={() => setPendingAction(action)}
              loading={loading === action.status}
              disabled={loading !== null}
              aria-pressed={isActive}
            >
              {loading === action.status ? null : <Icon className="h-4 w-4" aria-hidden />}
              {loading === action.status ? "Saving…" : action.label}
            </Button>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction ? `${pendingAction.label} this request?` : ""}
        message={pendingAction?.confirm ?? ""}
        confirmLabel={pendingAction?.label}
        tone={pendingAction?.status === "rejected" ? "danger" : "primary"}
        loading={loading !== null}
        reason={
          pendingAction?.status === "rejected"
            ? {
                label: "Rejection reason (required)",
                placeholder: "Explain why this request is being rejected…",
                defaultValue: "Registrar rejected this request after validation.",
              }
            : undefined
        }
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
