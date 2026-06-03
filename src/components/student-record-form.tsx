"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

type Option = {
  id: string;
  name: string;
};

export function StudentRecordForm({
  gradeLevels,
  sections,
}: {
  gradeLevels: Option[];
  sections: Option[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to save student record.");
      return;
    }

    toast.success("Student record saved.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add student record</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="LRN" name="lrn" required />
          <Field label="Student number" name="studentNumber" required />
          <Field label="First name" name="firstName" required />
          <Field label="Middle name" name="middleName" />
          <Field label="Last name" name="lastName" required />
          <Field label="Suffix" name="suffix" />
          <div className="grid gap-2">
            <Label htmlFor="gradeLevelId">Grade level</Label>
            <Select id="gradeLevelId" name="gradeLevelId" defaultValue="">
              <option value="">Not assigned</option>
              {gradeLevels.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sectionId">Section</Label>
            <Select id="sectionId" name="sectionId" defaultValue="">
              <option value="">Not assigned</option>
              {sections.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </div>
          <Field label="Contact number" name="contactNumber" />
          <Field label="Guardian name" name="guardianName" />
          <Field label="Guardian contact" name="guardianContact" />
          <div className="grid gap-2">
            <Label htmlFor="enrollmentStatus">Status</Label>
            <Select id="enrollmentStatus" name="enrollmentStatus" defaultValue="enrolled">
              <option value="enrolled">Enrolled</option>
              <option value="alumni">Alumni</option>
              <option value="transferred">Transferred</option>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              <UserPlus className="h-4 w-4" aria-hidden />
              {loading ? "Saving" : "Save student record"}
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
