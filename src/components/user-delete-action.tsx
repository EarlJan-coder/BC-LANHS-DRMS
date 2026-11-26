"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

export function UserDeleteAction({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to delete the account.");
        return;
      }
      toast.success("Account deleted.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to delete the account.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button
      type="button"
      size="icon"
      tone="ghost"
      className="text-red-900 hover:bg-red-50 hover:text-red-950"
      aria-label="Delete account"
      title="Delete account"
      onClick={() => setOpen(true)}
      disabled={busy}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </Button>
    <ConfirmDialog
      open={open}
      title="Delete this account?"
      message="This action permanently removes the account and its records. It cannot be undone."
      confirmLabel="Delete account"
      tone="danger"
      loading={busy}
      onConfirm={remove}
      onCancel={() => { if (!busy) setOpen(false); }}
    >
      <div className="rounded-lg border border-red-200 bg-red-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-900">The following will be deleted</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-red-900">
          <li>Login access and profile</li>
          <li>Document requests, certificates, and request history</li>
        </ul>
      </div>
    </ConfirmDialog>
  </>;
}
