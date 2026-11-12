"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Clock3, MailCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { CITY_NAMES, barangaysFor } from "@/lib/ph-address";

/** Marks a required field label. */
function Required() {
  return (
    <span className="text-red-600" aria-hidden="true">
      *
    </span>
  );
}

type AuthFormMode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: AuthFormMode; next?: string }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const termsCloseRef = useRef<HTMLButtonElement>(null);
  const [addressCity, setAddressCity] = useState("");
  const [addressBarangay, setAddressBarangay] = useState("");

  useEffect(() => {
    if (!termsOpen) return;
    termsCloseRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setTermsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [termsOpen]);

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
          suffix: formData.get("suffix"),
          phone: formData.get("phone"),
          addressCity: formData.get("addressCity"),
          addressBarangay: formData.get("addressBarangay"),
          addressStreetLine: formData.get("addressStreetLine"),
          lastSchoolYearAttended: formData.get("lastSchoolYearAttended"),
          password: formData.get("password"),
          acceptedTerms: termsAccepted,
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

          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Return to sign in
          </Link>
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
                <Label htmlFor="firstName">
                  First name <Required />
                </Label>
                <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={100} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="middleName">Middle name <span className="font-normal text-slate-500">(optional)</span></Label>
                <Input id="middleName" name="middleName" autoComplete="additional-name" maxLength={100} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">
                  Last name <Required />
                </Label>
                <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={100} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="suffix">Suffix</Label>
                <Select id="suffix" name="suffix" defaultValue="None">
                  <option value="None">None</option>
                  <option value="Jr.">Jr.</option>
                  <option value="Sr.">Sr.</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <Required />
              </Label>
              <Input id="email" name="email" type="email" autoComplete="email" required maxLength={191} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone <span className="font-normal text-slate-500">(optional)</span></Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="addressCity">
                  City <Required />
                </Label>
                <Select
                  id="addressCity"
                  name="addressCity"
                  required
                  value={addressCity}
                  onChange={(event) => {
                    setAddressCity(event.target.value);
                    setAddressBarangay("");
                  }}
                >
                  <option value="" disabled>
                    Select a city
                  </option>
                  {CITY_NAMES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addressBarangay">
                  Barangay <Required />
                </Label>
                <Select
                  id="addressBarangay"
                  name="addressBarangay"
                  required
                  disabled={!addressCity}
                  value={addressBarangay}
                  onChange={(event) => setAddressBarangay(event.target.value)}
                >
                  <option value="" disabled>
                    {addressCity ? "Select a barangay" : "Select a city first"}
                  </option>
                  {barangaysFor(addressCity).map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addressStreetLine">
                House no. / street <Required />
              </Label>
              <Input
                id="addressStreetLine"
                name="addressStreetLine"
                autoComplete="address-line1"
                required
                maxLength={500}
                placeholder="123 Mabini St."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastSchoolYearAttended">
                Last school year attended <Required />
              </Label>
              <Input
                id="lastSchoolYearAttended"
                name="lastSchoolYearAttended"
                required
                maxLength={40}
                placeholder="2025-2026"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lrn">
                Learner Reference Number (LRN) <Required />
              </Label>
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
          <Label htmlFor="password">
            Password {isSignup ? <Required /> : null}
          </Label>
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

        {isSignup ? (
          <div className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              id="accept-terms"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            <div>
              <label htmlFor="accept-terms">I have read the </label>
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Terms and Conditions
              </button>
            </div>
          </div>
        ) : null}

        <Button type="submit" loading={loading} disabled={isSignup && !termsAccepted} className="mt-1 w-full">
          {isSignup
            ? loading
              ? "Creating account…"
              : "Create account"
            : loading
              ? "Signing in…"
              : "Log in"}
        </Button>
      </form>
      {isSignup && termsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTermsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="signup-terms-title"
            aria-describedby="signup-terms-intro"
            className="flex max-h-[min(88vh,46rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Luis Aguado National High School</p>
                <h2 id="signup-terms-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Terms and Conditions</h2>
              </div>
              <button ref={termsCloseRef} type="button" onClick={() => setTermsOpen(false)} aria-label="Close terms and conditions" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div className="overflow-y-auto px-5 py-5 sm:px-7">
              <p id="signup-terms-intro" className="text-sm leading-6 text-slate-600">
                By creating an account, you agree to use the LANHS document and records system responsibly for legitimate school-related services.
              </p>
              <div className="mt-5 space-y-5 text-sm leading-6 text-slate-600">
                <section>
                  <h3 className="font-semibold text-slate-900">1. Accurate information</h3>
                  <p className="mt-1">You must provide truthful, current registration details, including your Learner Reference Number (LRN), and keep your contact information up to date. The school may review details and request clarification before approving access.</p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-900">2. Account security</h3>
                  <p className="mt-1">Keep your password private and use your own account. You are responsible for activity performed through your account. Notify the school if you believe someone else has accessed it.</p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-900">3. Appropriate use</h3>
                  <p className="mt-1">Use the system only to manage your own school records, submit document requests, and access services you are authorized to use. Do not impersonate another person, submit false information, attempt to access another user’s records, or disrupt the system.</p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-900">4. Personal information</h3>
                  <p className="mt-1">The school processes the personal information you submit to verify your identity, manage your account and school document requests, maintain records, and send service-related updates. Access is limited to authorized school personnel for these purposes and handled under applicable privacy requirements, including the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-900">5. Review and access</h3>
                  <p className="mt-1">Registration may remain pending while school personnel verify your details. Access can be limited or suspended when necessary to protect records, users, or the school’s services. Contact the registrar to correct account or record information.</p>
                </section>
                <section>
                  <h3 className="font-semibold text-slate-900">6. Service updates</h3>
                  <p className="mt-1">The school may update these terms or the system to reflect changes in school processes, security needs, or applicable requirements. Continued use after an update means you accept the revised terms.</p>
                </section>
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-xs text-slate-500">Close this window and check the box to continue registration.</p>
              <Button type="button" onClick={() => setTermsOpen(false)} className="w-full sm:w-auto">Close</Button>
            </footer>
          </section>
        </div>
      ) : null}
    </Card>
  );
}
