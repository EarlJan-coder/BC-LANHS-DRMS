"use client";

import { Check, FileSignature, RotateCcw, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import {
  DEFAULT_WORDING,
  PLACEHOLDER_FIELDS,
  type TemplateWording,
} from "@/lib/services/certificate-wording-defaults";
import { cn } from "@/lib/utils";

const TABS: Array<{ key: CertTemplateKey; label: string }> = [
  { key: "good-moral", label: "Good Moral (SHS)" },
  { key: "good-moral-jhs", label: "Good Moral (JHS)" },
  { key: "enrolment-jhs", label: "Enrolment (JHS)" },
  { key: "enrolment-shs", label: "Enrolment (SHS)" },
  { key: "graduation", label: "Graduation" },
];

/** Every editable value as a plain string so inputs and previews never see null. */
interface DraftWording {
  title: string;
  body: string;
  principalTitle: string;
  registrarTitle: string;
}

function toDraft(wording: TemplateWording): DraftWording {
  return {
    title: wording.title,
    body: wording.body,
    principalTitle: wording.principalTitle ?? "",
    registrarTitle: wording.registrarTitle ?? "",
  };
}

/** Field-by-field draft comparison for the save/reset in-flight guard. */
function draftsEqual(a: DraftWording, b: DraftWording): boolean {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.principalTitle === b.principalTitle &&
    a.registrarTitle === b.registrarTitle
  );
}

export function DocumentTemplateEditor({
  names: initialNames,
  wording,
}: {
  names: { registrarName: string; principalName: string };
  wording: Record<CertTemplateKey, TemplateWording>;
}) {
  const [names, setNames] = useState(initialNames);
  const [namesSaving, setNamesSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<CertTemplateKey, DraftWording>>(() => {
    const entries = TABS.map(({ key }) => [key, toDraft(wording[key])] as const);
    return Object.fromEntries(entries) as Record<CertTemplateKey, DraftWording>;
  });
  const [activeKey, setActiveKey] = useState<CertTemplateKey>("good-moral");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  // Bumped when each debounced preview request starts so the failure timer
  // below restarts instead of firing while a render is still in flight.
  const [previewRev, setPreviewRev] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // True while a preview request is pending so the spinner never hides a stale
  // render behind a silent wait.
  const [previewLoading, setPreviewLoading] = useState(true);
  // Set when the preview cannot render here (request failure, PDF viewer
  // disabled) so the spinner never hangs forever.
  const [previewFailed, setPreviewFailed] = useState(false);
  // Server-provided failure reason (e.g. "Body text is too long for this
  // document.") to show in place of the generic failure copy.
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);

  const draft = drafts[activeKey];
  const { title, body, principalTitle, registrarTitle } = draft;
  const showRegistrarTitle = DEFAULT_WORDING[activeKey].registrarTitle !== null;

  useEffect(() => {
    if (!previewLoading) return;
    const timer = window.setTimeout(() => {
      setPreviewLoading(false);
      setPreviewFailed(true);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [previewLoading, previewRev]);

  // Debounced draft-render preview: refetch 800ms after the last change to any
  // field (wording fields or signatory names) and swap the iframe's blob URL.
  // Loading/failure flags flip inside the async callbacks below — the effect
  // body only schedules work.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setPreviewRev((rev) => rev + 1);
      setPreviewLoading(true);
      setPreviewFailed(false);
      setPreviewErrorMessage(null);
      try {
        const response = await fetch("/api/document-template/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: activeKey,
            title,
            body,
            principalTitle,
            // Hidden registrar-title fields send "" — the API wants a string,
            // and "" on a null-default field means "no opinion".
            registrarTitle: showRegistrarTitle ? registrarTitle : "",
            principalName: names.principalName,
            registrarName: names.registrarName,
          }),
        });
        if (!response.ok) {
          // Surface the server's reason (e.g. over-long body) instead of a
          // generic message — the admin needs to know what to fix.
          let message: string | null = null;
          try {
            const data: unknown = await response.json();
            const serverError =
              typeof data === "object" && data !== null && "error" in data
                ? (data as { error?: unknown }).error
                : undefined;
            if (typeof serverError === "string" && serverError) message = serverError;
          } catch {
            // Non-JSON error body — keep the generic fallback.
          }
          if (cancelled) return;
          setPreviewErrorMessage(message);
          setPreviewLoading(false);
          setPreviewFailed(true);
          return;
        }
        const blob = await response.blob();
        if (cancelled) return;
        setPreviewUrl(URL.createObjectURL(blob));
        setPreviewErrorMessage(null);
        setPreviewFailed(false);
        setPreviewLoading(false);
      } catch {
        if (cancelled) return;
        setPreviewLoading(false);
        setPreviewFailed(true);
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeKey, showRegistrarTitle, title, body, principalTitle, registrarTitle, names.principalName, names.registrarName]);

  // Revoke the replaced blob URL (and the last one on unmount).
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Restore the caret after a placeholder chip splices text into the body.
  useEffect(() => {
    if (pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    const textarea = bodyRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  });

  function updateDraft(key: CertTemplateKey, patch: Partial<DraftWording>) {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function replaceDraft(key: CertTemplateKey, next: TemplateWording, sent: DraftWording) {
    // Only refresh from the server response if the user hasn't typed since the
    // request went out — otherwise their in-flight keystrokes win (the server
    // already holds the saved state either way).
    setDrafts((current) => (draftsEqual(current[key], sent) ? { ...current, [key]: toDraft(next) } : current));
  }

  function insertPlaceholder(field: (typeof PLACEHOLDER_FIELDS)[number]) {
    const textarea = bodyRef.current;
    const token = `{{${field}}}`;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? start;
    pendingCaret.current = start + token.length;
    updateDraft(activeKey, { body: body.slice(0, start) + token + body.slice(end) });
  }

  const defaults = DEFAULT_WORDING[activeKey];
  const edited = {
    title: title !== defaults.title,
    body: body !== defaults.body,
    principalTitle: principalTitle !== (defaults.principalTitle ?? ""),
    registrarTitle: registrarTitle !== (defaults.registrarTitle ?? ""),
  };

  async function saveNames(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNamesSaving(true);
    try {
      const response = await fetch("/api/document-signatory-template", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(names),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to save the names.");
        return;
      }
      setNames(result.data);
      toast.success("Document template names saved.");
    } catch {
      toast.error("Unable to save the names. Check your connection and try again.");
    } finally {
      setNamesSaving(false);
    }
  }

  async function saveWording() {
    const sent: DraftWording = { title, body, principalTitle, registrarTitle };
    setSaving(true);
    try {
      const response = await fetch("/api/document-template/wording", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: activeKey,
          title,
          body,
          principalTitle,
          registrarTitle: showRegistrarTitle ? registrarTitle : "",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to save the document template.");
        return;
      }
      replaceDraft(activeKey, result.data, sent);
      toast.success("Document template saved.");
    } catch {
      toast.error("Unable to save the document template. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function resetWording() {
    const sent: DraftWording = { title, body, principalTitle, registrarTitle };
    setResetting(true);
    try {
      const response = await fetch(`/api/document-template/wording?template=${activeKey}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to reset the wording.");
        return;
      }
      replaceDraft(activeKey, result.data, sent);
      toast.success("Original wording restored.");
    } catch {
      toast.error("Unable to reset the wording. Check your connection and try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Signatories</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveNames}>
              <div className="space-y-2">
                <Label htmlFor="principal-name">Principal name</Label>
                <Input
                  id="principal-name"
                  autoComplete="name"
                  maxLength={200}
                  value={names.principalName}
                  onChange={(event) => setNames({ ...names, principalName: event.target.value })}
                  placeholder="e.g. Maria Santos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrar-name">Registrar name</Label>
                <Input
                  id="registrar-name"
                  autoComplete="name"
                  maxLength={200}
                  value={names.registrarName}
                  onChange={(event) => setNames({ ...names, registrarName: event.target.value })}
                  placeholder="e.g. Juan Dela Cruz"
                />
              </div>
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <Button type="submit" loading={namesSaving} disabled={namesSaving}>
                  {namesSaving ? null : <Check className="h-4 w-4" aria-hidden />}
                  {namesSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 text-brand">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">How it works</p>
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li className="flex gap-3">
                  <UserRound className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span>Default signatory names and edited wording apply to all certificates.</span>
                </li>
                <li className="flex gap-3">
                  <FileSignature className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span>A registrar may still override the signatories for a particular certificate.</span>
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span>Certificates already printed on paper keep their wording; re-downloads use the latest wording.</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificate wording</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div role="tablist" aria-label="Certificate templates" className="flex flex-wrap gap-1">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`document-template-tab-${key}`}
                  aria-selected={activeKey === key}
                  aria-controls="document-template-panel"
                  onClick={() => setActiveKey(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    activeKey === key
                      ? "bg-brand text-white shadow-sm"
                      : "text-slate-600 hover:bg-rose-50 hover:text-brand",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id="document-template-panel"
              aria-labelledby={`document-template-tab-${activeKey}`}
              className="grid gap-4"
            >
              <Field
                id="document-template-title"
                label="Document title"
                value={title}
                edited={edited.title}
                onChange={(value) => updateDraft(activeKey, { title: value })}
                maxLength={200}
              />
              <div>
                <Field
                  id="document-template-body"
                  label="Body"
                  value={body}
                  edited={edited.body}
                  onChange={(value) => updateDraft(activeKey, { body: value })}
                  textarea
                  textAreaRef={bodyRef}
                  maxLength={4000}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PLACEHOLDER_FIELDS.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => insertPlaceholder(field)}
                      className="rounded-full border border-border bg-white px-2 py-0.5 font-mono text-xs text-slate-600 transition hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {`{{${field}}}`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Wrap **text** to make it bold.</p>
              </div>
              <Field
                id="document-template-principal-title"
                label="Principal title"
                value={principalTitle}
                edited={edited.principalTitle}
                onChange={(value) => updateDraft(activeKey, { principalTitle: value })}
                maxLength={120}
              />
              {showRegistrarTitle ? (
                <Field
                  id="document-template-registrar-title"
                  label="Registrar title"
                  value={registrarTitle}
                  edited={edited.registrarTitle}
                  onChange={(value) => updateDraft(activeKey, { registrarTitle: value })}
                  maxLength={120}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button type="button" onClick={saveWording} loading={saving} disabled={saving || resetting}>
                {saving ? null : <Save className="h-4 w-4" aria-hidden />}
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" tone="secondary" onClick={resetWording} loading={resetting} disabled={saving || resetting}>
                {resetting ? null : <RotateCcw className="h-4 w-4" aria-hidden />}
                {resetting ? "Resetting…" : "Reset to original wording"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <iframe
              src={previewUrl ?? undefined}
              title="Document template PDF preview"
              aria-busy={previewLoading || undefined}
              className="h-[720px] w-full rounded-md border border-border bg-slate-100"
              onError={() => {
                setPreviewLoading(false);
                setPreviewFailed(true);
              }}
            />
            {previewLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-slate-50">
                <Spinner className="h-6 w-6 text-brand" />
                <p className="text-sm text-slate-600">Rendering certificate PDF…</p>
              </div>
            ) : null}
            {previewFailed && !previewLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {previewErrorMessage ?? "Preview unavailable in this browser."}
                </p>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">Preview uses sample student data.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  edited,
  onChange,
  textarea = false,
  textAreaRef,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  edited: boolean;
  onChange: (value: string) => void;
  textarea?: boolean;
  textAreaRef?: RefObject<HTMLTextAreaElement | null>;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {edited ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            edited
          </span>
        ) : null}
      </label>
      {textarea ? (
        <textarea
          id={id}
          ref={textAreaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={8}
          maxLength={maxLength}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      )}
    </div>
  );
}
