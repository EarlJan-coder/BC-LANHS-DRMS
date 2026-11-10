"use client";

import { useState, type FormEvent } from "react";
import { Check, FileSignature, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function DocumentSignatoryTemplateForm({ initialValues }: { initialValues: { registrarName: string; principalName: string } }) {
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/document-signatory-template", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save the names.");
      setValues(result.data);
      toast.success("Document template names saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the names.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <span className="rounded-xl bg-rose-50 p-3 text-brand"><FileSignature className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="font-semibold text-slate-950">Default signatories</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">These names are prefilled in certificates and printed by default. Registrars can still adjust them for an individual document.</p>
          </div>
        </div>
        <form className="space-y-5" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="principal-name">Principal name</Label>
            <Input id="principal-name" autoComplete="name" maxLength={200} value={values.principalName} onChange={(event) => setValues({ ...values, principalName: event.target.value })} placeholder="e.g. Maria Santos" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrar-name">Registrar name</Label>
            <Input id="registrar-name" autoComplete="name" maxLength={200} value={values.registrarName} onChange={(event) => setValues({ ...values, registrarName: event.target.value })} placeholder="e.g. Juan Dela Cruz" />
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button type="submit" loading={busy}><Check className="h-4 w-4" aria-hidden />Save template</Button>
          </div>
        </form>
      </Card>

      <Card className="h-fit border-rose-100 bg-gradient-to-br from-white to-rose-50/60 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-brand"><ShieldCheck className="h-4 w-4" aria-hidden /><p className="text-xs font-semibold uppercase tracking-[0.14em]">How it works</p></div>
        <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
          <li className="flex gap-3"><UserRound className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden /><span>These defaults appear in the registrar certificate editor and its PDF preview.</span></li>
          <li className="flex gap-3"><FileSignature className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden /><span>A registrar may enter a different signatory for a particular certificate.</span></li>
          <li className="flex gap-3"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden /><span>Changing these defaults does not alter previously saved certificate overrides.</span></li>
        </ul>
      </Card>
    </div>
  );
}
