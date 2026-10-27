"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function ResetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to reset the password right now.");
        return;
      }

      toast.success("Password reset. They will be asked to change it at next sign in.");
      setPassword("");
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to reset the password right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!isOpen ? (
        <Button type="button" size="sm" tone="secondary" onClick={() => setIsOpen(true)}>
          Reset password
        </Button>
      ) : (
        <Card className="w-full min-w-[260px]">
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor={`reset-password-${userId}`}>New password for {email}</Label>
                <Input
                  id={`reset-password-${userId}`}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" loading={loading}>
                  Confirm
                </Button>
                <Button
                  type="button"
                  size="sm"
                  tone="secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
