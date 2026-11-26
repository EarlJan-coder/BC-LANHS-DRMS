"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { REGISTRATION_DECLINE_REASONS } from "@/lib/constants";
import type { RegistrationStatus } from "@/lib/types";

export function UserApprovalActions({
  userId,
  registrationStatus,
}: {
  userId: string;
  registrationStatus: RegistrationStatus;
}) {
  const router = useRouter();
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [busy, setBusy] = useState<"approved" | "declined" | null>(null);
  const [error, setError] = useState("");

  if (registrationStatus !== "pending") {
    return (
      <span className="text-sm text-slate-600">
        {registrationStatus === "approved" ? "Approved" : "Declined"}
      </span>
    );
  }

  async function decide(decision: "approved" | "declined", reason = "") {
    if (busy) return;
    setBusy(decision);
    setError("");
    try {
      const response = await fetch(`/api/registrations/${userId}/decision`, {
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
      toast.success(decision === "approved" ? "Account approved." : "Account declined.");
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
    <div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" tone="success" onClick={() => decide("approved")} loading={busy === "approved"} disabled={busy !== null}>
          Approve
        </Button>
        <Button type="button" size="sm" tone="danger" onClick={() => setConfirmingDecline(true)} disabled={busy !== null}>
          Decline
        </Button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-900" role="alert">{error}</p> : null}
      <ConfirmDialog
        open={confirmingDecline}
        title="Decline this account?"
        message="A reason is required. It will be emailed to the account owner."
        confirmLabel="Decline"
        tone="danger"
        loading={busy === "declined"}
        reason={{
          label: "Reason for declining (required)",
          options: REGISTRATION_DECLINE_REASONS,
          placeholder: "Explain why this account is being declined…",
        }}
        onConfirm={(reason) => decide("declined", reason)}
        onCancel={() => {
          if (busy !== "declined") setConfirmingDecline(false);
        }}
      />
    </div>
  );
}
