"use client";

import { RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_WORDING, PLACEHOLDER_FIELDS, type TemplateWording } from "@/lib/services/certificate-wording-defaults";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import type { DocumentTypeTemplateView } from "@/lib/services/document-type-templates";
import { Spinner } from "@/components/ui/spinner";

const LAYOUTS: Array<{ key: CertTemplateKey; label: string }> = [
  { key: "enrolment-jhs", label: "Enrolment · Junior High" },
  { key: "enrolment-shs", label: "Enrolment · Senior High" },
  { key: "good-moral-jhs", label: "Good Moral · Junior High" },
  { key: "good-moral", label: "Good Moral · Senior High" },
  { key: "graduation", label: "Graduation" },
];

type Draft = TemplateWording & { layoutKey: CertTemplateKey };
const toDraft = (item: DocumentTypeTemplateView): Draft => ({ layoutKey: item.layoutKey, ...item.wording });

export function DocumentTypeTemplateEditor({
  templates,
  names,
}: {
  templates: DocumentTypeTemplateView[];
  names: { registrarName: string; principalName: string };
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.documentTypeId ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(templates.map((item) => [item.documentTypeId, toDraft(item)])),
  );
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const [previewError, setPreviewError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const active = templates.find((item) => item.documentTypeId === selectedId);
  const draft = drafts[selectedId];

  useEffect(() => {
    if (!active || !draft) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewState("loading");
      setPreviewError("");
      try {
        const response = await fetch("/api/document-type-templates/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            principalTitle: draft.principalTitle ?? "",
            registrarTitle: draft.registrarTitle ?? "",
            principalName: names.principalName,
            registrarName: names.registrarName,
          }),
        });
        if (!response.ok) {
          let message = "Unable to render this preview.";
          try {
            const data = await response.json();
            if (typeof data.error === "string") message = data.error;
          } catch { /* keep fallback */ }
          if (!cancelled) {
            setPreviewError(message);
            setPreviewState("error");
          }
          return;
        }
        const url = URL.createObjectURL(await response.blob());
        if (cancelled) URL.revokeObjectURL(url);
        else {
          setPreviewUrl(url);
          setPreviewState("ready");
        }
      } catch {
        if (!cancelled) setPreviewState("error");
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, draft, names.principalName, names.registrarName]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    bodyRef.current?.focus();
    bodyRef.current?.setSelectionRange(caret, caret);
  });

  function update(patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [selectedId]: { ...current[selectedId], ...patch } }));
  }

  function insertPlaceholder(field: (typeof PLACEHOLDER_FIELDS)[number]) {
    const textarea = bodyRef.current;
    const body = draft?.body ?? "";
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? start;
    const token = `{{${field}}}`;
    pendingCaret.current = start + token.length;
    update({ body: body.slice(0, start) + token + body.slice(end) });
  }

  async function save() {
    if (!active || !draft) return;
    setSaving(true);
    try {
      const response = await fetch("/api/document-type-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentTypeId: selectedId, ...draft, principalTitle: draft.principalTitle ?? "", registrarTitle: draft.registrarTitle ?? "" }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to save this document template.");
        return;
      }
      setDrafts((current) => ({ ...current, [selectedId]: toDraft(result.data) }));
      toast.success(`Template saved for ${active.documentTypeName}.`);
    } catch {
      toast.error("Unable to save this template. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!active) return;
    setResetting(true);
    try {
      const response = await fetch(`/api/document-type-templates/${selectedId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to reset this template.");
        return;
      }
      setDrafts((current) => ({ ...current, [selectedId]: toDraft(result.data) }));
      toast.success("Template reset to its default wording.");
    } catch {
      toast.error("Unable to reset this template. Check your connection and try again.");
    } finally {
      setResetting(false);
    }
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-32 items-center justify-center p-6 text-center text-sm text-slate-600">
          No custom document types yet. Add one in Document type management to create its template here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Custom document template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="custom-template-type" className="mb-1.5 block text-sm font-medium text-slate-700">Document type</label>
            <select
              id="custom-template-type"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {templates.map((item) => <option key={item.documentTypeId} value={item.documentTypeId}>{item.documentTypeName}{item.isCustomized ? " · customized" : " · default"}</option>)}
            </select>
          </div>
          {draft ? <>
            <div>
              <label htmlFor="custom-template-layout" className="mb-1.5 block text-sm font-medium text-slate-700">PDF page layout</label>
              <select
                id="custom-template-layout"
                value={draft.layoutKey}
                onChange={(event) => update({ layoutKey: event.target.value as CertTemplateKey })}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {LAYOUTS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
              </select>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">Uses the selected official LANHS page design, including its header, seals, spacing, and signature area.</p>
            </div>
            <TextField id="custom-template-title" label="Document title" value={draft.title} onChange={(title) => update({ title })} maxLength={200} />
            <div>
              <TextField id="custom-template-body" label="Certificate wording" value={draft.body} onChange={(body) => update({ body })} multiline maxLength={4000} textareaRef={bodyRef} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLACEHOLDER_FIELDS.map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => insertPlaceholder(field)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 transition hover:border-brand hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    aria-label={`Insert ${field} placeholder`}
                  >
                    {`{{${field}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Placeholders are filled from the request and student record. Use **text** for bold emphasis.</p>
            </div>
            <TextField id="custom-template-principal-title" label="Principal role/title" value={draft.principalTitle ?? ""} onChange={(principalTitle) => update({ principalTitle })} maxLength={120} />
            {DEFAULT_WORDING[draft.layoutKey].registrarTitle !== null ? <TextField id="custom-template-registrar-title" label="Registrar role/title" value={draft.registrarTitle ?? ""} onChange={(registrarTitle) => update({ registrarTitle })} maxLength={120} /> : null}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button type="button" tone="success" onClick={save} loading={saving} disabled={saving || resetting}><Save className="h-4 w-4" aria-hidden />Save template</Button>
              <Button type="button" tone="secondary" onClick={reset} loading={resetting} disabled={saving || resetting}><RotateCcw className="h-4 w-4" aria-hidden />Reset to default</Button>
            </div>
          </> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live PDF preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative min-h-[520px]">
            {previewUrl && previewState !== "error" ? <iframe title={`${active?.documentTypeName ?? "Custom document"} PDF preview`} src={previewUrl} className="h-[520px] w-full rounded-md border border-border bg-slate-100" /> : null}
            {previewState === "loading" ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-slate-50"><Spinner className="h-6 w-6 text-brand" /><p className="text-sm text-slate-600">Updating preview…</p></div> : null}
            {previewState === "error" ? <div className="absolute inset-0 flex items-center justify-center rounded-md border border-border bg-slate-50 p-6 text-center text-sm text-slate-600">{previewError || "Preview unavailable. Check the wording and try again."}</div> : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">Preview uses sample student details. Generated certificates use the actual request data.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  textareaRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    {multiline ? <textarea ref={textareaRef} id={id} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} rows={7} className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-brand" /> : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-brand" />}
  </div>;
}
