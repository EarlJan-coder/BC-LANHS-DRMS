"use client";

import { Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ProfileUpdateForm({
  email,
  contactNumber,
  guardian,
  hasStudentRecord,
  triggerClassName,
}: {
  email: string;
  contactNumber: string;
  guardian: string;
  hasStudentRecord: boolean;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // onSubmit (not <form action>): form actions suppress mid-flight state and
  // auto-reset uncontrolled fields on completion (same fix as auth-form).
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactNumber: formData.get("contactNumber") ?? undefined,
          guardianName: formData.get("guardianName") ?? undefined,
          email: formData.get("email") ?? undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to update profile.");
        return;
      }

      toast.success("Profile updated.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to update profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function editableValue(value: string) {
    return value === "Not set" || value.includes("student profile") ? "" : value;
  }

  return (
    <>
      <Button type="button" tone="secondary" size="sm" className={triggerClassName} onClick={() => setOpen(true)} aria-label="Edit profile">
        <Pencil className="h-4 w-4" aria-hidden />
        Edit
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id="edit-profile-title" className="text-lg font-semibold text-slate-950">
                  Edit contact details
                </h2>
                <p className="mt-1 text-sm text-slate-500">Update how the school reaches you.</p>
              </div>
              <Button
                type="button"
                tone="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Close edit contact details dialog"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <form onSubmit={submit}>
              <fieldset disabled={saving} className="contents">
                <div className="grid gap-4 px-5 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-contactNumber">Contact number</Label>
                    <Input
                      id="profile-contactNumber"
                      name="contactNumber"
                      defaultValue={editableValue(contactNumber)}
                      disabled={!hasStudentRecord}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-guardianName">Guardian name</Label>
                    <Input
                      id="profile-guardianName"
                      name="guardianName"
                      defaultValue={editableValue(guardian)}
                      disabled={!hasStudentRecord}
                    />
                  </div>
                  {!hasStudentRecord ? (
                    <p className="text-sm text-slate-500">
                      Contact the registrar to link your student record before updating contact number and guardian name.
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" name="email" type="email" defaultValue={editableValue(email)} required />
                    <p className="text-xs text-slate-500">You will use this email to sign in.</p>
                  </div>
                </div>
              </fieldset>

              <div className="flex flex-col-reverse gap-2 border-t border-border bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <Button type="button" tone="secondary" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {saving ? null : <Save className="h-4 w-4" aria-hidden />}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
