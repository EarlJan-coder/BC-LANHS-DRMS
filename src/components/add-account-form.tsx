"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

type FormState = {
  email: string;
  firstName: string;
  lastName: string;
  role: "registrar" | "admin";
  password: string;
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
  password: "",
};

function roleLabel(role: string): string {
  switch (role) {
    case "registrar":
      return "Registrar";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}

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
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to create the account right now.");
        return;
      }

      setCreated({
        user: data.user,
        password: form.password,
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

  if (created) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account created</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{created.fullName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{created.user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Role</dt>
              <dd className="font-medium text-slate-900">{roleLabel(created.user.role)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Placeholder password</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-900">{created.password}</code>
                <Button type="button" size="sm" tone="secondary" onClick={copyPassword}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </dd>
            </div>
          </dl>
          <p className="text-sm text-slate-600">They will be required to change this password when they first sign in.</p>
          <div>
            <Button type="button" onClick={() => setCreated(null)}>Create another account</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6">
      {!isOpen ? (
        <Button type="button" onClick={() => setIsOpen(true)}>
          Add account
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Add account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
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
                  <Label htmlFor="lastName">Last name</Label>
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
                <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="role">Role</Label>
                  <Select
                    id="role"
                    name="role"
                    value={form.role}
                    onChange={(event) => updateField("role", event.target.value as FormState["role"])}
                    required
                  >
                    <option value="registrar">Registrar</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Placeholder password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button type="submit" loading={loading}>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
