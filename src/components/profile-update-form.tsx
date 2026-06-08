"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function ProfileUpdateForm({
  lrn,
  contactNumber,
  guardian,
  address,
}: {
  lrn: string;
  contactNumber: string;
  guardian: string;
  address: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lrn: formData.get("lrn"),
        contactNumber: formData.get("contactNumber"),
        guardianName: formData.get("guardianName"),
        address: formData.get("address"),
      }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to update profile.");
      return;
    }

    toast.success("Profile updated.");
    router.refresh();
  }

  function editableValue(value: string) {
    return value === "Not set" || value.includes("student profile") ? "" : value;
  }

  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="lrn">Learner Reference Number (LRN)</Label>
        <Input id="lrn" name="lrn" defaultValue={editableValue(lrn)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactNumber">Contact number</Label>
        <Input id="contactNumber" name="contactNumber" defaultValue={editableValue(contactNumber)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="guardianName">Guardian</Label>
        <Input id="guardianName" name="guardianName" defaultValue={editableValue(guardian)} />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" defaultValue={editableValue(address)} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4" aria-hidden />
          {loading ? "Saving" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
