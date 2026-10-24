"use client";

import { Download, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CertificateEditValues {
  studentName: string;
  gradeLevel: string;
  section: string;
  purpose: string;
  /** yyyy-mm-dd for <input type="date"> */
  dateGenerated: string;
}

export function CertificatePreviewEditor({
  certificateId,
  initial,
  hasOverride,
}: {
  certificateId: string;
  initial: CertificateEditValues;
  hasOverride: Record<keyof CertificateEditValues, boolean>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Bumped after each save so the iframe re-renders the PDF with new content.
  const [previewRev, setPreviewRev] = useState(0);

  function setField(field: keyof CertificateEditValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/certificates/${certificateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: values.studentName,
          gradeLevel: values.gradeLevel,
          section: values.section,
          purpose: values.purpose,
          dateGenerated: values.dateGenerated,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to save changes.");
        return;
      }

      toast.success("Certificate content saved. Preview updated.");
      setPreviewRev((rev) => rev + 1);
      router.refresh();
    } catch {
      toast.error("Unable to save changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function resetToRecord() {
    // Blank every field → PATCH clears all overrides → then re-fetch the live
    // values so the form matches what the PDF now renders.
    setClearing(true);
    try {
      const response = await fetch(`/api/certificates/${certificateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: "", gradeLevel: "", section: "", purpose: "", dateGenerated: "" }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to reset changes.");
        return;
      }

      const viewResponse = await fetch(`/api/certificates/${certificateId}`);
      if (viewResponse.ok) {
        const view = await viewResponse.json();
        setValues({
          studentName: view.studentName,
          gradeLevel: view.gradeLevel,
          section: view.section,
          purpose: view.purpose,
          dateGenerated: view.dateGenerated.slice(0, 10),
        });
      }

      toast.success("Overrides cleared. Preview now shows the record values.");
      setPreviewRev((rev) => rev + 1);
      router.refresh();
    } catch {
      toast.error("Unable to reset changes. Check your connection and try again.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Edit PDF content</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="Student name"
            value={values.studentName}
            override={hasOverride.studentName}
            onChange={(value) => setField("studentName", value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Grade level"
              value={values.gradeLevel}
              override={hasOverride.gradeLevel}
              onChange={(value) => setField("gradeLevel", value)}
            />
            <Field
              label="Section"
              value={values.section}
              override={hasOverride.section}
              onChange={(value) => setField("section", value)}
            />
          </div>
          <Field
            label="Purpose"
            value={values.purpose}
            override={hasOverride.purpose}
            onChange={(value) => setField("purpose", value)}
            textarea
          />
          <Field
            label="Date generated"
            value={values.dateGenerated}
            override={hasOverride.dateGenerated}
            onChange={(value) => setField("dateGenerated", value)}
            type="date"
          />

          <p className="text-xs text-slate-500">
            School year, certificate number, and certificate type are not editable — they are covered by
            certificate verification.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={save} loading={saving} disabled={saving || clearing}>
              <Save className="h-4 w-4" aria-hidden />
              Save &amp; refresh preview
            </Button>
            <Button type="button" tone="secondary" onClick={resetToRecord} loading={clearing} disabled={saving || clearing}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset to record values
            </Button>
            <a
              href={`/api/certificates/${certificateId}/pdf`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download PDF
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PDF preview</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            key={previewRev}
            src={`/api/certificates/${certificateId}/pdf?inline=1&rev=${previewRev}`}
            title="Certificate PDF preview"
            className="h-[720px] w-full rounded-md border border-border bg-slate-100"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  override,
  onChange,
  textarea = false,
  type = "text",
}: {
  label: string;
  value: string;
  override: boolean;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {override ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            edited
          </span>
        ) : null}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      )}
    </div>
  );
}
