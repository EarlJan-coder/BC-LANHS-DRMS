"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export function StudentRecordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // onSubmit (not <form action>): form actions suppress mid-flight state and
  // auto-reset uncontrolled fields on completion (same fix as auth-form).
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Unable to save student record.");
        return;
      }

      toast.success("Student record saved.");
      router.refresh();
    } catch {
      toast.error("Unable to save student record.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add student record</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="LRN" name="lrn" required />
          <Field label="First name" name="firstName" required />
          <Field label="Middle name" name="middleName" />
          <Field label="Last name" name="lastName" required />
          <Field label="Suffix" name="suffix" />
          <Field label="Contact number" name="contactNumber" />
          <div className="grid gap-2">
            <Label htmlFor="enrollmentStatus">Status</Label>
            <Select id="enrollmentStatus" name="enrollmentStatus" defaultValue="enrolled">
              <option value="enrolled">Enrolled</option>
              <option value="alumni">Alumni</option>
              <option value="transferred">Transferred</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={loading}>
              {loading ? null : <UserPlus className="h-4 w-4" aria-hidden />}
              {loading ? "Saving…" : "Save student record"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} />
    </div>
  );
}
