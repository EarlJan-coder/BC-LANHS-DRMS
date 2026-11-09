"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Clock3, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

type AuthFormMode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: AuthFormMode; next?: string }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  // onSubmit (not <form action>): form actions auto-reset uncontrolled fields
  // when they complete, wiping the form on failed attempts (same fix as
  // change-password-form in ee0fc4d).
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const signupEmail = isSignup ? String(formData.get("email") ?? "") : "";
    const payload = isSignup
      ? {
          email: formData.get("email"),
          lrn: formData.get("lrn"),
          firstName: formData.get("firstName"),
          middleName: formData.get("middleName"),
          lastName: formData.get("lastName"),
          phone: formData.get("phone"),
          address: formData.get("address"),
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
        setLoading(false);
        return;
      }

      if (isSignup) {
        setRegisteredEmail(signupEmail);
        setSuccess(result.message ?? "Registration submitted. Check your email for updates after review.");
        setLoading(false);
      } else {
        // Keep the button pending through navigation; only errors clear it.
        router.replace(next ?? "/dashboard");
        router.refresh();
      }
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  if (isSignup && success) {
    return (
      <Card className="p-6 sm:p-7">
        <section role="status" aria-live="polite" className="grid gap-5">
          <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
              <Clock3 size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Registration status</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">On hold</h2>
            </div>
          </div>

          <div className="grid gap-2">
            <h3 className="text-lg font-semibold text-slate-950">Registrar is confirming your identity</h3>
            <p className="text-sm leading-6 text-slate-600">
              Your registration has been submitted. You can sign in after the registrar approves your account.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <MailCheck size={19} className="mt-0.5 shrink-0 text-slate-600" aria-hidden="true" />
            <p className="text-sm leading-6 text-slate-600">
              We’ll email {registeredEmail ? <span className="font-semibold text-slate-900">{registeredEmail}</span> : "you"} when your account is approved. The email will include a link to sign in. If your LRN is shared, use this email address to log in.
            </p>
          </div>

          <a
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Return to sign in
          </a>
        </section>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <form onSubmit={submit} className="grid gap-4">
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
              <Label htmlFor="middleName">Middle name <span className="font-normal text-slate-500">(optional)</span></Label>
              <Input id="middleName" name="middleName" autoComplete="additional-name" maxLength={100} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required maxLength={191} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone <span className="font-normal text-slate-500">(optional)</span></Label>
                <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address <span className="font-normal text-slate-500">(optional)</span></Label>
                <Input id="address" name="address" autoComplete="street-address" maxLength={2000} />
              </div>
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
            <p className="text-xs text-slate-500">Use your email if multiple accounts share an LRN.</p>
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

        {success ? (
          <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}

        <Button type="submit" loading={loading} className="mt-1 w-full">
          {isSignup
            ? loading
              ? "Creating account…"
              : "Create account"
            : loading
              ? "Signing in…"
              : "Log in"}
        </Button>
      </form>
    </Card>
  );
}
