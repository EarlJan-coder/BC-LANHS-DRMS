"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function ResetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reset, setReset] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!reset) return;

    try {
      await navigator.clipboard.writeText(reset.password);
      setCopied(true);
      toast.success("Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  async function handleReset() {
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to reset the password right now.");
        return;
      }

      toast.success("Password reset. They will be asked to change it at next sign in.");
      setReset({ email, password: data.temporaryPassword });
      router.refresh();
    } catch {
      toast.error("Unable to reset the password right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" tone="secondary" onClick={handleReset} loading={loading}>
        Reset password
      </Button>
      <Modal
        open={Boolean(reset)}
        onClose={() => setReset(null)}
        title="Password reset"
        description="Share this temporary password with the account owner. They will be asked to change it at next sign in."
        className="max-w-md"
      >
        {reset ? (
          <div className="space-y-5">
            <dl className="grid gap-3 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="break-all text-right font-medium text-slate-900">{reset.email}</dd>
              </div>
            </dl>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Temporary password</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <code className="min-w-0 break-all rounded bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900">{reset.password}</code>
                <Button type="button" size="sm" tone="secondary" onClick={copyPassword}>
                  {copied ? "Copied" : "Copy password"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="button" tone="secondary" onClick={() => setReset(null)}>Done</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
