"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

type AuthFormMode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: AuthFormMode; next?: string }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");

    const payload = isSignup
      ? {
          email: formData.get("email"),
          lrn: formData.get("lrn"),
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          password: formData.get("password"),
        }
      : {
          identifier: formData.get("identifier"),
          password: formData.get("password"),
        };

    try {
      const response = await fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Unable to continue. Check your details and try again.");
        return;
      }

      router.replace(next ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <form action={submit} className="grid gap-4">
        {isSignup ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={100} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={100} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required maxLength={191} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lrn">Learner Reference Number (LRN)</Label>
              <Input
                id="lrn"
                name="lrn"
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]{12}"
                minLength={12}
                maxLength={12}
                placeholder="12-digit LRN"
                required
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="identifier">Email or LRN</Label>
            <Input id="identifier" name="identifier" autoComplete="username" required />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            maxLength={72}
            required
          />
          {isSignup ? <p className="text-xs text-slate-500">Use at least 8 characters.</p> : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={loading} className="mt-1 w-full">
          {isSignup ? "Create account" : "Log in"}
        </Button>
      </form>
    </Card>
  );
}
