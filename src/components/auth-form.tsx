"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { Clock3, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Required, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordPolicyChecklist } from "@/components/password-policy-checklist";
import { LegalDocumentModal } from "@/components/legal-document-modal";
import { PRIVACY_NOTICE, TERMS_DOCUMENT, type LegalDocumentKey } from "@/lib/legal-documents";
import { meetsPasswordPolicy } from "@/lib/password-policy";
import { CITY_NAMES, barangaysFor } from "@/lib/ph-address";

type AuthFormMode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: AuthFormMode; next?: string }) {
  const isSignup = mode === "signup";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [openDocument, setOpenDocument] = useState<LegalDocumentKey | null>(null);
  const closeDocument = useCallback(() => setOpenDocument(null), []);
  const [addressCity, setAddressCity] = useState("");
  const [addressBarangay, setAddressBarangay] = useState("");
  const [studentStatus, setStudentStatus] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  // onSubmit (not <form action>): form actions auto-reset uncontrolled fields
  // when they complete, wiping the form on failed attempts (same fix as
  // change-password-form in ee0fc4d).
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    // The button is disabled until both boxes are checked and the password
    // policy is met, but Enter-key implicit submission can bypass that, so
    // enforce it here too.
    if (isSignup && !(termsAccepted && privacyAccepted)) return;
    if (isSignup && !meetsPasswordPolicy(passwordValue)) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(event.currentTarget);
    const signupEmail = isSignup ? String(formData.get("email") ?? "") : "";

    if (isSignup && formData.get("password") !== formData.get("confirmPassword")) {
      setError("Those passwords do not match.");
      setLoading(false);
      return;
    }

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
        studentStatus: formData.get("studentStatus"),
        currentSchoolYear: formData.get("currentSchoolYear") ?? "",
        lastSchoolYearAttended: formData.get("lastSchoolYearAttended") ?? "",
        password: formData.get("password"),
        acceptedTerms: termsAccepted,
        acceptedPrivacy: privacyAccepted,
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
        // Hard navigation on purpose: a client-side replace can replay a stale
        // Router Cache entry — e.g. the middleware's /change-password redirect
        // cached while the account still held a temporary password — sending a
        // fresh login back to the change-password screen until a full refresh.
        // A document load is evaluated by the server and purges those caches.
        window.location.replace(next ?? "/dashboard");
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
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Pending Review</h2>
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2"
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
            <section className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid gap-2">
                <Label htmlFor="studentStatus">Student status <Required /></Label>
                <Select id="studentStatus" name="studentStatus" value={studentStatus} onChange={(event) => setStudentStatus(event.target.value)} aria-describedby="student-status-hint" required>
                  <option value="" disabled>Select status</option>
                  <option value="student">Student</option>
                  <option value="alumni">Alumni</option>
                </Select>
                <p id="student-status-hint" className="text-xs leading-5 text-slate-500">Choose the option that best describes your current school status.</p>
              </div>
              {studentStatus === "student" ? (
                <div className="grid gap-2 border-t border-slate-200 pt-4">
                  <Label htmlFor="currentSchoolYear">Current school year <Required /></Label>
                  <Input id="currentSchoolYear" name="currentSchoolYear" required maxLength={40} placeholder="2025-2026" />
                  <p className="text-xs leading-5 text-slate-500">Enter the school year you are currently attending.</p>
                </div>
              ) : null}
              {studentStatus === "alumni" ? (
                <div className="grid gap-2 border-t border-slate-200 pt-4">
                  <Label htmlFor="lastSchoolYearAttended">Last school year attended <Required /></Label>
                  <Input id="lastSchoolYearAttended" name="lastSchoolYearAttended" required maxLength={40} placeholder="2025-2026" />
                  <p className="text-xs leading-5 text-slate-500">Enter the last school year you attended at this school.</p>
                </div>
              ) : null}
            </section>
            <div className="grid gap-2">
              <Label htmlFor="lrn">
                Learner Reference Number (LRN) {studentStatus !== "alumni" ? <Required /> : null}
              </Label>
              <Input
                id="lrn"
                name="lrn"
                autoComplete="off"
                inputMode="numeric"
                pattern={studentStatus === "alumni" ? undefined : "[0-9]{12}"}
                minLength={studentStatus === "alumni" ? undefined : 12}
                maxLength={12}
                placeholder="12-digit LRN"
                required={studentStatus !== "alumni"}
              />
              {studentStatus === "alumni" ? <p className="text-xs leading-5 text-slate-500">Optional for alumni — leave blank if you no longer remember it.</p> : null}
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="identifier">
              Email or LRN <Required />
            </Label>
            <Input id="identifier" name="identifier" autoComplete="username" required />
            <p className="text-xs text-slate-500">Use your email if multiple accounts share an LRN.</p>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="password">Password <Required /></Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            maxLength={72}
            required
            onChange={(event) => setPasswordValue(event.target.value)}
          />
          {isSignup ? <PasswordPolicyChecklist password={passwordValue} /> : null}
        </div>

        {isSignup ? (
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">
              Confirm password <Required />
            </Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        {success ? (
          <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}

        {isSignup ? (
          <div className="grid gap-3">
            <div className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                id="accept-terms"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              />
              <div>
                <label htmlFor="accept-terms">I have read and accept the </label>
                <button
                  type="button"
                  onClick={() => setOpenDocument("terms")}
                  className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Terms and Conditions
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                id="accept-privacy"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              />
              <div>
                <label htmlFor="accept-privacy">I have read and accept the </label>
                <button
                  type="button"
                  onClick={() => setOpenDocument("privacy")}
                  className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Privacy Notice
                </button>
              </div>
            </div>
            {!termsAccepted || !privacyAccepted ? (
              <p className="text-xs text-slate-500">Check both boxes to continue with registration.</p>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          tone={isSignup ? "success" : "primary"}
          loading={loading}
          disabled={isSignup && (!(termsAccepted && privacyAccepted) || !meetsPasswordPolicy(passwordValue))}
          className="mt-1 w-full"
        >
          {isSignup
            ? loading
              ? "Creating account…"
              : "Create account"
            : loading
              ? "Signing in…"
              : "Log in"}
        </Button>
      </form>
      {isSignup && openDocument ? (
        <LegalDocumentModal
          document={openDocument === "terms" ? TERMS_DOCUMENT : PRIVACY_NOTICE}
          onClose={closeDocument}
        />
      ) : null}
    </Card>
  );
}
