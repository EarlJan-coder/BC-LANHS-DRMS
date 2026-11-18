"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { REGISTRATION_DECLINE_REASONS } from "@/lib/constants";
import type { PendingRegistrationView } from "@/lib/types";

export function RegistrationApproveActions({ registration }: { registration: PendingRegistrationView }) {
  const router = useRouter();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [busy, setBusy] = useState<"approved" | "declined" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "declined", reason = "") {
    if (busy) return;
    setBusy(decision);
    setError("");
    try {
      const response = await fetch(`/api/registrations/${registration.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result.error ?? "Unable to review this registration.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(decision === "approved" ? "Registration approved." : "Registration declined.");
      setConfirmingDecline(false);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      toast.error("Unable to review this registration.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <tr className="hover:bg-rose-50/40">
      <td className="px-4 py-3 font-medium text-slate-800">{registration.name}</td>
      <td className="px-4 py-3 text-slate-700">{registration.lrn}</td>
      <td className="px-4 py-3 text-slate-700">{registration.email}</td>
      <td className="px-4 py-3 text-slate-700">{registration.lastSchoolYearAttended}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Button type="button" tone="success" onClick={() => decide("approved")} loading={busy === "approved"} disabled={busy !== null}>
            Approve
          </Button>
          <Button type="button" tone="danger" onClick={() => setConfirmingDecline(true)} disabled={busy !== null}>
            Decline
          </Button>
        </div>
        {error ? <p className="mt-1 text-xs text-red-700" role="alert">{error}</p> : null}
        <ConfirmDialog
          open={confirmingDecline}
          title="Decline this registration?"
          message="A reason is required. It will be emailed to the student."
          confirmLabel="Decline"
          tone="danger"
          loading={busy === "declined"}
          reason={{
            label: "Reason for declining (required)",
            options: REGISTRATION_DECLINE_REASONS,
            placeholder: "Explain why this registration is being declined…",
          }}
          onConfirm={(reason) => decide("declined", reason)}
          onCancel={() => {
            if (busy !== "declined") setConfirmingDecline(false);
          }}
        />
      </td>
    </tr>
  );
}
