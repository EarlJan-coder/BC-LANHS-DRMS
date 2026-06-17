"use client";

import { Pencil, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { StudentView } from "@/lib/types";

type Option = {
  id: string;
  name: string;
  gradeLevelId?: string | null;
};

const statusOptions = [
  { value: "enrolled", label: "Enrolled" },
  { value: "alumni", label: "Alumni" },
  { value: "transferred", label: "Transferred" },
  { value: "inactive", label: "Inactive" },
];

export function StudentRecordActions({
  student,
  gradeLevels,
  sections,
}: {
  student: StudentView;
  gradeLevels: Option[];
  sections: Option[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState(student.gradeLevelId);
  const [selectedSectionId, setSelectedSectionId] = useState(student.sectionId);
  const filteredSections = useMemo(
    () =>
      selectedGradeLevelId
        ? sections.filter((section) => !section.gradeLevelId || section.gradeLevelId === selectedGradeLevelId)
        : [],
    [sections, selectedGradeLevelId],
  );

  function openEditor() {
    setSelectedGradeLevelId(student.gradeLevelId);
    setSelectedSectionId(student.sectionId);
    setEditing(true);
  }

  async function onSubmit(formData: FormData) {
    setSaving(true);

    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Unable to update student record.");
        return;
      }

      toast.success("Student record updated.");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Unable to update student record.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this student record? Records with linked grades, requests, or certificates cannot be deleted.",
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? "Unable to delete student record.");
        return;
      }

      toast.success("Student record deleted.");
      router.refresh();
    } catch {
      toast.error("Unable to delete student record.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" tone="secondary" size="sm" onClick={openEditor} aria-label={`Edit ${student.name}`}>
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </Button>
        <Button
          type="button"
          tone="danger"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete ${student.name}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {deleting ? "Deleting" : "Delete"}
        </Button>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-student-${student.id}`}
            className="w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id={`edit-student-${student.id}`} className="text-lg font-semibold text-slate-950">
                  Edit student record
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {student.lrn} - {student.name}
                </p>
              </div>
              <Button
                type="button"
                tone="ghost"
                size="icon"
                onClick={() => setEditing(false)}
                aria-label="Close edit student dialog"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <form action={onSubmit}>
              <div className="grid max-h-[calc(100vh-14rem)] gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
                <Field label="LRN" name="lrn" defaultValue={student.lrn} required />
                <Field label="First name" name="firstName" defaultValue={student.firstName} required />
                <Field label="Middle name" name="middleName" defaultValue={student.middleName} />
                <Field label="Last name" name="lastName" defaultValue={student.lastName} required />
                <Field label="Suffix" name="suffix" defaultValue={student.suffix} />
                <div className="grid gap-2">
                  <Label htmlFor={`edit-gradeLevelId-${student.id}`}>Grade level</Label>
                  <Select
                    id={`edit-gradeLevelId-${student.id}`}
                    name="gradeLevelId"
                    value={selectedGradeLevelId}
                    onChange={(event) => {
                      setSelectedGradeLevelId(event.target.value);
                      setSelectedSectionId("");
                    }}
                  >
                    <option value="">Not assigned</option>
                    {gradeLevels.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`edit-sectionId-${student.id}`}>Section</Label>
                  <Select
                    id={`edit-sectionId-${student.id}`}
                    name="sectionId"
                    value={selectedSectionId}
                    onChange={(event) => setSelectedSectionId(event.target.value)}
                    disabled={!selectedGradeLevelId}
                  >
                    <option value="">{selectedGradeLevelId ? "Not assigned" : "Select a grade level first"}</option>
                    {filteredSections.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Field label="Contact number" name="contactNumber" defaultValue={student.contactNumber} />
                <Field label="Guardian name" name="guardianName" defaultValue={student.guardianName} />
                <Field label="Guardian contact" name="guardianContact" defaultValue={student.guardianContact} />
                <div className="grid gap-2">
                  <Label htmlFor={`edit-enrollmentStatus-${student.id}`}>Status</Label>
                  <Select id={`edit-enrollmentStatus-${student.id}`} name="enrollmentStatus" defaultValue={student.status}>
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor={`edit-address-${student.id}`}>Address</Label>
                  <Textarea id={`edit-address-${student.id}`} name="address" defaultValue={student.address} />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <Button type="button" tone="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4" aria-hidden />
                  {saving ? "Saving" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} required={required} />
    </div>
  );
}
