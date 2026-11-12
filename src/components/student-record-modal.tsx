"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { StudentView } from "@/lib/types";

const enrollmentOptions = [
  { value: "enrolled", label: "Enrolled" },
  { value: "alumni", label: "Alumni" },
  { value: "transferred", label: "Transferred" },
  { value: "inactive", label: "Inactive" },
];

type StudentDraft = {
  lrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  email: string;
  phone: string;
  address: string;
  lastSchoolYearAttended: string;
  status: string;
  registrationStatus: StudentView["registrationStatus"];
  registrationNote: string;
};

function toDraft(student: StudentView): StudentDraft {
  return {
    lrn: student.lrn,
    firstName: student.firstName,
    middleName: student.middleName,
    lastName: student.lastName,
    suffix: student.suffix,
    email: student.email,
    phone: student.phone,
    address: student.address,
    lastSchoolYearAttended: student.lastSchoolYearAttended,
    status: student.status,
    registrationStatus: student.registrationStatus,
    registrationNote: "",
  };
}

export function StudentRecordModal({ student }: { student: StudentView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(student));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const restoresAccount = student.registrationStatus === "declined" && draft.registrationStatus === "approved";

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving && !deleting) setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, saving, deleting]);

  function show() {
    setDraft(toDraft(student));
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lrn: draft.lrn,
          firstName: draft.firstName,
          middleName: draft.middleName,
          lastName: draft.lastName,
          suffix: draft.suffix,
          email: draft.email,
          contactNumber: draft.phone,
          address: draft.address,
          lastSchoolYearAttended: draft.lastSchoolYearAttended,
          enrollmentStatus: draft.status,
          registrationStatus: draft.registrationStatus,
          registrationNote: draft.registrationNote,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to update the student record.");
        return;
      }
      toast.success(restoresAccount ? "Student record saved and account approved." : "Student record updated.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to update the student record. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to delete the student record.");
        return;
      }
      toast.success("Student record deleted. The account remains active.");
      setConfirmDeleteOpen(false);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to delete the student record. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button type="button" tone="secondary" size="sm" onClick={show} aria-label={`View ${student.name}`}>
        View
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`student-record-title-${student.id}`}
            className="w-full max-w-3xl rounded-lg border border-border bg-white shadow-xl"
          >
            <header className="border-b border-border px-5 py-4">
              <h2 id={`student-record-title-${student.id}`} className="text-lg font-semibold text-slate-950">Student record</h2>
              <p className="mt-1 text-sm text-slate-500">Edit the student profile and account status.</p>
            </header>

            <form onSubmit={save}>
              <fieldset disabled={saving || deleting} className="grid max-h-[calc(100vh-14rem)] gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
                <Field id={`student-lrn-${student.id}`} label="LRN" value={draft.lrn} maxLength={30} onChange={(lrn) => setDraft({ ...draft, lrn })} required />
                <Field id={`student-first-${student.id}`} label="First name" value={draft.firstName} maxLength={100} onChange={(firstName) => setDraft({ ...draft, firstName })} required />
                <Field id={`student-middle-${student.id}`} label="Middle name" value={draft.middleName} maxLength={100} onChange={(middleName) => setDraft({ ...draft, middleName })} />
                <Field id={`student-last-${student.id}`} label="Last name" value={draft.lastName} maxLength={100} onChange={(lastName) => setDraft({ ...draft, lastName })} required />
                <Field id={`student-suffix-${student.id}`} label="Suffix" value={draft.suffix} maxLength={20} onChange={(suffix) => setDraft({ ...draft, suffix })} />
                <Field id={`student-email-${student.id}`} label="Email" type="email" value={draft.email} maxLength={191} onChange={(email) => setDraft({ ...draft, email })} />
                <Field id={`student-phone-${student.id}`} label="Phone" type="tel" value={draft.phone} maxLength={30} onChange={(phone) => setDraft({ ...draft, phone })} />
                <Field
                  id={`student-school-year-${student.id}`}
                  label="Last school year attended"
                  value={draft.lastSchoolYearAttended}
                  maxLength={40}
                  placeholder="2025-2026"
                  onChange={(lastSchoolYearAttended) => setDraft({ ...draft, lastSchoolYearAttended })}
                />
                <div className="grid gap-2">
                  <Label htmlFor={`student-status-${student.id}`}>Student status</Label>
                  <Select id={`student-status-${student.id}`} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                    {enrollmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`student-account-status-${student.id}`}>Account</Label>
                  <Select
                    id={`student-account-status-${student.id}`}
                    value={draft.registrationStatus}
                    disabled={student.registrationStatus !== "declined"}
                    onChange={(event) => setDraft({ ...draft, registrationStatus: event.target.value as StudentView["registrationStatus"] })}
                  >
                    <option value={student.registrationStatus}>
                      {student.registrationStatus === "pending" ? "On hold" : student.registrationStatus[0].toUpperCase() + student.registrationStatus.slice(1)}
                    </option>
                    {student.registrationStatus === "declined" ? <option value="approved">Approved</option> : null}
                  </Select>
                  {student.registrationStatus === "declined" ? <p className="text-xs text-slate-500">Declined accounts can be restored here.</p> : null}
                </div>
                {restoresAccount ? (
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor={`student-approval-note-${student.id}`}>Approval note sent by email</Label>
                    <Textarea
                      id={`student-approval-note-${student.id}`}
                      value={draft.registrationNote}
                      onChange={(event) => setDraft({ ...draft, registrationNote: event.target.value })}
                      required
                      maxLength={2000}
                      rows={2}
                    />
                  </div>
                ) : null}
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={`student-address-${student.id}`}>Address</Label>
                  <Textarea id={`student-address-${student.id}`} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} rows={3} />
                </div>
              </fieldset>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-slate-50 px-5 py-4">
                <div>
                  <Button type="button" tone="danger" onClick={() => setConfirmDeleteOpen(true)} disabled={saving || deleting || student.hasLinkedRecords}>
                    Delete
                  </Button>
                  {student.hasLinkedRecords ? <p className="mt-1 text-xs text-slate-500">Requests or certificates are linked, so this record cannot be deleted.</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" tone="secondary" onClick={() => setOpen(false)} disabled={saving || deleting}>Cancel</Button>
                  <Button type="submit" loading={saving} disabled={restoresAccount && !draft.registrationNote.trim()}>Save</Button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this student record?"
        message="This removes only the student record. The linked login account survives and keeps its LRN."
        confirmLabel="Delete record"
        tone="danger"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  maxLength,
  placeholder,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} maxLength={maxLength} placeholder={placeholder} required={required} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
