"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentTypeView } from "@/lib/types";

type Draft = Omit<DocumentTypeView, "id" | "status">;

const blankDraft: Draft = {
  name: "",
  code: "",
  description: "",
  requirements: [],
  processingDays: 3,
  fee: 0,
  isActive: true,
};

export function DocumentTypesManager({ initialTypes }: { initialTypes: DocumentTypeView[] }) {
  const router = useRouter();
  const [types, setTypes] = useState(initialTypes);
  const [draft, setDraft] = useState(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft>(blankDraft);
  const [busy, setBusy] = useState(false);

  async function request(path: string, method: string, data?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to save document types.");
    return result;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await request("/api/document-types", "POST", draft);
      setTypes((current) => [...current, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setDraft(blankDraft);
      toast.success("Document type added.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add the document type.");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    setBusy(true);
    try {
      const result = await request(`/api/document-types/${id}`, "PATCH", editing);
      setTypes((current) => current.map((item) => (item.id === id ? result.data : item)));
      setEditingId(null);
      toast.success("Document type updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the document type.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    setBusy(true);
    try {
      await request(`/api/document-types/${id}`, "DELETE");
      setTypes((current) => current.map((item) => (item.id === id ? { ...item, isActive: false, status: "Inactive" } : item)));
      toast.success("Document type deactivated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate the document type.");
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: DocumentTypeView) => editingId === row.id ? <Input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={120} /> : row.name,
    },
    {
      key: "code",
      label: "Code",
      render: (row: DocumentTypeView) => editingId === row.id ? <Input value={editing.code} onChange={(event) => setEditing({ ...editing, code: event.target.value })} maxLength={40} /> : row.code,
    },
    {
      key: "days",
      label: "Processing days",
      render: (row: DocumentTypeView) => editingId === row.id ? <Input type="number" min={0} max={365} value={editing.processingDays} onChange={(event) => setEditing({ ...editing, processingDays: Number(event.target.value) })} className="w-28" /> : row.processingDays,
    },
    { key: "status", label: "Status", render: (row: DocumentTypeView) => row.status },
    {
      key: "actions",
      label: "Actions",
      render: (row: DocumentTypeView) => editingId === row.id ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => save(row.id)} loading={busy}>Save</Button>
          <Button type="button" size="sm" tone="secondary" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            tone="secondary"
            disabled={busy}
            onClick={() => {
              setEditingId(row.id);
              setEditing({
                name: row.name,
                code: row.code,
                description: row.description,
                requirements: row.requirements,
                processingDays: row.processingDays,
                fee: row.fee,
                isActive: row.isActive,
              });
            }}
          >Edit</Button>
          <Button type="button" size="sm" tone="danger" onClick={() => deactivate(row.id)} disabled={busy || !row.isActive}>Deactivate</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="grid gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-medium text-slate-700">Name<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={120} /></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Code<Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} required maxLength={40} /></label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Processing days<Input type="number" min={0} max={365} value={draft.processingDays} onChange={(event) => setDraft({ ...draft, processingDays: Number(event.target.value) })} required /></label>
        <Button type="submit" loading={busy}>Add type</Button>
      </form>
      <DataTable
        rows={types}
        columns={columns}
        emptyMessage="No document types found. Run npm run db:seed or add document types."
      />
    </div>
  );
}
