"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Required, Select } from "@/components/ui/input";
import { roleLabel } from "@/lib/utils";

type FormState = {
  email: string;
  firstName: string;
  lastName: string;
  role: "registrar" | "student";
  lrn: string;
  studentStatus: "student" | "alumni";
};

type CreatedUser = {
  id: string;
  email: string;
  role: string;
};

const initialFormState: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  role: "registrar",
  lrn: "",
  studentStatus: "student",
};


export function AddAccountForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [created, setCreated] = useState<{ user: CreatedUser; password: string; fullName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          lrn: form.role === "student" ? form.lrn : undefined,
          studentStatus: form.role === "student" ? form.studentStatus : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to create the account right now.");
        return;
      }

      setCreated({
        user: data.user,
        password: data.temporaryPassword,
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      });
      setForm(initialFormState);
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to create the account right now.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (!created) return;

    try {
      await navigator.clipboard.writeText(created.password);
      setCopied(true);
      toast.success("Copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div>
      <Button type="button" tone="success" onClick={() => setIsOpen(true)}>
        Add account
      </Button>
      <Modal
        open={isOpen || Boolean(created)}
        onClose={() => {
          if (loading) return;
          if (created) setCreated(null);
          else setIsOpen(false);
        }}
        title={created ? "Account created" : "Add account"}
        description={created ? "Share this temporary sign-in password with the account owner." : "Create a registrar or student account with a temporary password."}
        className={created ? "max-w-md" : undefined}
      >
        {created ? (
          <div className="space-y-5">
            <dl className="grid gap-3 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{created.fullName}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Email</dt>
                <dd className="break-all text-right font-medium text-slate-900">{created.user.email}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-900">{roleLabel(created.user.role)}</dd>
              </div>
            </dl>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Temporary password</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <code className="min-w-0 break-all rounded bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900">{created.password}</code>
                <Button type="button" size="sm" tone="secondary" onClick={copyPassword}>
                  {copied ? "Copied" : "Copy password"}
                </Button>
              </div>
            </div>
            <p className="text-sm leading-5 text-slate-600">They will be required to change this password when they first sign in.</p>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="button" tone="success" onClick={() => setCreated(null)}>Done</Button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name <Required /></Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={(event) => updateField("firstName", event.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name <Required /></Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={(event) => updateField("lastName", event.target.value)}
                    required
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <Required /></Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role <Required /></Label>
                  <Select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={(event) => updateField("role", event.target.value as FormState["role"])}
                    required
                  >
                    <option value="registrar">Registrar</option>
                    <option value="student">Student</option>
                  </Select>
                </div>
                {form.role === "student" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="lrn">LRN {form.studentStatus !== "alumni" ? <Required /> : null}</Label>
                    <Input
                      id="lrn"
                      name="lrn"
                      value={form.lrn}
                      onChange={(event) => updateField("lrn", event.target.value)}
                      required={form.studentStatus !== "alumni"}
                      inputMode="numeric"
                      pattern={form.studentStatus === "alumni" ? undefined : "[0-9]{12}"}
                      minLength={form.studentStatus === "alumni" ? undefined : 12}
                      maxLength={12}
                      autoComplete="off"
                    />
                    <Label htmlFor="studentStatus">Student status</Label>
                    <Select id="studentStatus" value={form.studentStatus} onChange={(event) => updateField("studentStatus", event.target.value as FormState["studentStatus"])}>
                      <option value="student">Student</option>
                      <option value="alumni">Alumni</option>
                    </Select>
                  </div>
                ) : null}
              </div>
              <p className="text-sm text-slate-600">
                A temporary password will be generated automatically. Share it with the account owner — they will be
                required to change it when they first sign in.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button type="submit" tone="success" loading={loading}>
                  Create account
                </Button>
                <Button
                  type="button"
                  tone="secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
        </form>
        )}
      </Modal>
    </div>
  );
}
