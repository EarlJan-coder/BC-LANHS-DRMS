"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PendingRegistrationView } from "@/lib/types";

export function RegistrationApproveActions({ registration }: { registration: PendingRegistrationView }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approved" | "declined" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "declined") {
    if (!note.trim() || busy) {
      setError("Add a note before reviewing this registration.");
      return;
    }
    setBusy(decision);
    setError("");
    try {
      const response = await fetch(`/api/registrations/${registration.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result.error ?? "Unable to review this registration.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(decision === "approved" ? "Registration approved." : "Registration declined.");
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
      <td className="px-4 py-3 text-slate-700">{registration.email}</td>
      <td className="px-4 py-3">
        <Button type="button" onClick={() => decide("approved")} loading={busy === "approved"} disabled={!note.trim() || busy !== null}>
          Approve
        </Button>
      </td>
      <td className="px-4 py-3">
        <Button type="button" tone="danger" onClick={() => decide("declined")} loading={busy === "declined"} disabled={!note.trim() || busy !== null}>
          Decline
        </Button>
      </td>
      <td className="min-w-64 px-4 py-3">
        <label className="sr-only" htmlFor={`registration-note-${registration.id}`}>Note for {registration.name}</label>
        <textarea
          id={`registration-note-${registration.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Required note sent by email"
          disabled={busy !== null}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-slate-50"
        />
        {error ? <p className="mt-1 text-xs text-red-700" role="alert">{error}</p> : null}
      </td>
    </tr>
  );
}
