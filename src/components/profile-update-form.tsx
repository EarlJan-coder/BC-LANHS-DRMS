"use client";

import { Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { CITY_NAMES, barangaysFor, parseAddress } from "@/lib/ph-address";

export function ProfileUpdateForm({
  email,
  contactNumber,
  address,
  lastSchoolYearAttended,
  hasStudentRecord,
  triggerClassName,
}: {
  email: string;
  contactNumber: string;
  address: string;
  lastSchoolYearAttended: string;
  hasStudentRecord: boolean;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialAddress = parseAddress(editableValue(address));
  const [addressCity, setAddressCity] = useState(initialAddress.city);
  const [addressBarangay, setAddressBarangay] = useState(initialAddress.barangay);
  const [addressStreetLine, setAddressStreetLine] = useState(initialAddress.streetLine);

  // Address fields are only required (and only sent) once the student starts
  // editing the address. A legacy free-text address must not block editing
  // the school year — the whole point of the no_school_year unblock flow.
  const addressDirty =
    addressCity !== initialAddress.city ||
    addressBarangay !== initialAddress.barangay ||
    addressStreetLine !== initialAddress.streetLine;

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
          email: formData.get("email") ?? undefined,
          lastSchoolYearAttended: formData.get("lastSchoolYearAttended") ?? undefined,
          ...(addressDirty
            ? {
                addressCity,
                addressBarangay,
                addressStreetLine,
              }
            : {}),
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
                  Edit profile details
                </h2>
                <p className="mt-1 text-sm text-slate-500">Update your contact, address, and school year details.</p>
              </div>
              <Button
                type="button"
                tone="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Close edit profile dialog"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <form onSubmit={submit}>
              <fieldset disabled={saving} className="contents">
                <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-5 py-5">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-lastSchoolYearAttended">
                      Last school year attended <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="profile-lastSchoolYearAttended"
                      name="lastSchoolYearAttended"
                      defaultValue={editableValue(lastSchoolYearAttended)}
                      placeholder="2025-2026"
                      maxLength={40}
                      required
                      disabled={!hasStudentRecord}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="profile-addressCity">
                        City <span className="text-red-600">*</span>
                      </Label>
                      <Select
                        id="profile-addressCity"
                        name="addressCity"
                        required={addressDirty}
                        disabled={!hasStudentRecord}
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
                      <Label htmlFor="profile-addressBarangay">
                        Barangay <span className="text-red-600">*</span>
                      </Label>
                      <Select
                        id="profile-addressBarangay"
                        name="addressBarangay"
                        required={addressDirty}
                        disabled={!hasStudentRecord || !addressCity}
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
                    <Label htmlFor="profile-addressStreetLine">
                      House no. / street <span className="text-red-600">*</span>
                    </Label>
                    <Input
                      id="profile-addressStreetLine"
                      name="addressStreetLine"
                      autoComplete="address-line1"
                      maxLength={500}
                      required={addressDirty}
                      disabled={!hasStudentRecord}
                      value={addressStreetLine}
                      onChange={(event) => setAddressStreetLine(event.target.value)}
                      placeholder="123 Mabini St."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="profile-contactNumber">Contact number</Label>
                    <Input
                      id="profile-contactNumber"
                      name="contactNumber"
                      defaultValue={editableValue(contactNumber)}
                      disabled={!hasStudentRecord}
                    />
                  </div>
                  {!hasStudentRecord ? (
                    <p className="text-sm text-slate-500">
                      Contact the registrar to link your student record before updating your details.
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
