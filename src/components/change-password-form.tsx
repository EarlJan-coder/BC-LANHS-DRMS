"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Required } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordPolicyChecklist } from "@/components/password-policy-checklist";
import { meetsPasswordPolicy } from "@/lib/password-policy";

export function ChangePasswordForm({ mustChangePassword }: { mustChangePassword: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (!meetsPasswordPolicy(String(newPassword ?? ""))) {
      setError("Choose a password that meets every requirement below.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Those passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Unable to change the password right now.");
        setLoading(false);
        return;
      }

      // The API bumps tokenVersion and re-issues a session; sign out so the
      // user logs in fresh with the new password (their chosen flow). Hard
      // navigation so no stale Router Cache entry can replay the forced
      // change-password screen after the next login.
      toast.success("Password changed — sign in with your new password.");
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      // Keep the button pending through navigation; only errors clear it.
      window.location.replace("/sign-in");
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {mustChangePassword ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Choose a new password to continue.
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="currentPassword">Current password <Required /></Label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="newPassword">New password <Required /></Label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          onChange={(event) => setNewPasswordValue(event.target.value)}
        />
        <PasswordPolicyChecklist password={newPasswordValue} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirm new password <Required /></Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" tone="success" loading={loading} disabled={!meetsPasswordPolicy(newPasswordValue)} className="mt-1 w-full">
        {loading ? "Changing…" : "Set new password"}
      </Button>
    </form>
  );
}
