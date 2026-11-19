"use client";

import { Database, Mail, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SystemHealthCheck } from "@/lib/services/system-health";
import type { SystemSettings } from "@/lib/services/system-settings";

const icons = {
  storage: Database,
  "sign-in": ShieldCheck,
  email: Mail,
  proofs: Settings,
} as const;

export type TechnicalDetail = { label: string; value: string };

export function SystemSettingsPanel({
  initialSettings,
  initialStatuses,
  technical,
}: {
  initialSettings: SystemSettings;
  initialStatuses: SystemHealthCheck[];
  technical: TechnicalDetail[];
}) {
  const [saved, setSaved] = useState<SystemSettings>(initialSettings);
  const [draft, setDraft] = useState<SystemSettings>(initialSettings);
  const [statuses, setStatuses] = useState<SystemHealthCheck[]>(initialStatuses);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function checkNow() {
    setChecking(true);
    try {
      const response = await fetch("/api/settings/status");
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to check right now. Try again.");
        return;
      }
      setStatuses(result.data);
    } catch {
      toast.error("Unable to check right now. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to save your settings. Try again.");
        return;
      }
      setSaved(result.data);
      setDraft(result.data);
      toast.success("Your settings are saved.");
    } catch {
      toast.error("Unable to save your settings. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function finishProofs() {
    setRetrying(true);
    try {
      const response = await fetch("/api/blockchain/retry", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Unable to finish the pending proofs. Try again.");
        return;
      }
      const { attempted, submitted } = result.retry ?? {};
      toast.success(
        attempted
          ? `Done. Checked ${attempted} proof(s) and recorded ${submitted}.`
          : "Nothing to finish — the proofs are up to date.",
      );
      await checkNow();
    } catch {
      toast.error("Unable to finish the pending proofs. Check your connection and try again.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div>
      <section aria-labelledby="health-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="health-heading" className="text-lg font-semibold text-slate-950">
            Is everything working?
          </h2>
          <Button type="button" tone="secondary" onClick={checkNow} loading={checking}>
            {checking ? "Checking…" : "Check again"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {statuses.map((item) => {
            const Icon = icons[item.key];
            const working = item.state === "working";

            return (
              <Card key={item.key} className="p-5">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                      working
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-amber-50 text-amber-700 ring-amber-200",
                    )}
                  >
                    {working ? "Working" : "Needs attention"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.sentence}</p>
                {item.needsDeveloper ? (
                  <div className="mt-3 rounded-md bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-700">Ask your developer to fix this.</p>
                    {item.technical ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-slate-500">Technical details</summary>
                        <p className="mt-1 font-mono text-xs text-slate-500">{item.technical}</p>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="preferences-heading" className="mt-10">
        <h2 id="preferences-heading" className="text-lg font-semibold text-slate-950">
          Preferences
        </h2>

        <Card className="mt-3 divide-y divide-border">
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <Label htmlFor="signup-open">Should students be able to sign up themselves?</Label>
              <p className="mt-1 text-sm text-slate-500">
                When this is off, new students cannot create an account. Existing accounts keep working.
              </p>
            </div>
            <Switch
              id="signup-open"
              ariaLabel="Allow students to sign up themselves"
              checked={draft.signupOpen}
              onCheckedChange={(next) => setDraft({ ...draft, signupOpen: next })}
            />
          </div>

          <div className="p-5">
            <Label htmlFor="email-from-name">Who should emails come from?</Label>
            <p className="mt-1 text-sm text-slate-500">Students see this name and address on emails from the portal.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                id="email-from-name"
                value={draft.emailFromName}
                maxLength={100}
                onChange={(event) => setDraft({ ...draft, emailFromName: event.target.value })}
              />
              <Input
                id="email-from-address"
                type="email"
                value={draft.emailFromAddress}
                maxLength={191}
                onChange={(event) => setDraft({ ...draft, emailFromAddress: event.target.value })}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <Label htmlFor="auto-fix-proofs">Should failed proofs be fixed automatically?</Label>
              <p className="mt-1 text-sm text-slate-500">
                The system quietly finishes proof records that failed, a few at a time. Safe to leave on.
              </p>
            </div>
            <Switch
              id="auto-fix-proofs"
              ariaLabel="Fix failed proofs automatically"
              checked={draft.autoFixProofs}
              onCheckedChange={(next) => setDraft({ ...draft, autoFixProofs: next })}
            />
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} loading={saving} disabled={!dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {dirty ? (
            <p className="text-sm font-medium text-amber-700">You have unsaved changes.</p>
          ) : (
            <p className="text-sm text-slate-500">All changes are saved.</p>
          )}
        </div>

        <Card className="mt-6 p-5">
          <h3 className="text-base font-semibold text-slate-950">Finish pending proofs now</h3>
          <p className="mt-1 text-sm text-slate-500">
            Records any proof that is still waiting. This is safe to click. Nothing will be lost.
          </p>
          <div className="mt-3">
            <Button type="button" tone="info" onClick={finishProofs} loading={retrying}>
              {retrying ? "Working…" : "Finish pending proofs now"}
            </Button>
          </div>
        </Card>
      </section>

      <section aria-labelledby="technical-heading" className="mt-10">
        <details>
          <summary id="technical-heading" className="cursor-pointer text-sm font-medium text-slate-700">
            Technical details (for your developer)
          </summary>
          <Card className="mt-3 p-5">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {technical.map((detail) => (
                <div key={detail.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{detail.label}</dt>
                  <dd className="font-mono text-xs text-slate-700">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </details>
      </section>
    </div>
  );
}
