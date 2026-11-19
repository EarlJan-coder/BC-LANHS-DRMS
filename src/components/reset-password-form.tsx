"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  if (reset) {
    return (
      <Card className="w-full min-w-[260px]">
        <CardHeader>
          <CardTitle>Password reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{reset.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Temporary password</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-900">{reset.password}</code>
                <Button type="button" size="sm" tone="secondary" onClick={copyPassword}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </dd>
            </div>
          </dl>
          <p className="text-sm text-slate-600">They will be required to change this password when they next sign in.</p>
          <div>
            <Button type="button" size="sm" tone="secondary" onClick={() => setReset(null)}>
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button type="button" size="sm" tone="secondary" onClick={handleReset} loading={loading}>
      Reset password
    </Button>
  );
}
