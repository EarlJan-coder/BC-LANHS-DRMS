"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Modal } from "@/components/ui/modal";
import { Input, Required } from "@/components/ui/input";
import type { DocumentTypeView } from "@/lib/types";
import { formatDocumentFee } from "@/lib/utils";

type Draft = Omit<DocumentTypeView, "id" | "status">;

const blankDraft: Draft = {
  name: "",
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
  const [deleteTarget, setDeleteTarget] = useState<DocumentTypeView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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
      setCreateOpen(false);
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
      const row = types.find((item) => item.id === id);
      if (!row) throw new Error("Document type not found.");
      await request(`/api/document-types/${id}`, "PATCH", { name: row.name, description: row.description, requirements: row.requirements, processingDays: row.processingDays, fee: row.fee, isActive: false });
      setTypes((current) => current.map((item) => (item.id === id ? { ...item, isActive: false, status: "Inactive" } : item)));
      toast.success("Document type deactivated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to deactivate the document type.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDocumentType() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await request(`/api/document-types/${deleteTarget.id}`, "DELETE");
      setTypes((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Document type deleted.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the document type.");
    } finally {
      setBusy(false);
    }
  }

  async function enable(row: DocumentTypeView) {
    setBusy(true);
    try {
      await request(`/api/document-types/${row.id}`, "PATCH", { name: row.name, description: row.description, requirements: row.requirements, processingDays: row.processingDays, fee: row.fee, isActive: true });
      setTypes((current) => current.map((item) => (item.id === row.id ? { ...item, isActive: true, status: "Active" } : item)));
      toast.success("Document type enabled.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to enable the document type.");
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
      key: "days",
      label: "Processing days",
      render: (row: DocumentTypeView) => editingId === row.id ? <Input type="number" min={0} max={365} value={editing.processingDays} onChange={(event) => setEditing({ ...editing, processingDays: Number(event.target.value) })} className="w-28" /> : row.processingDays,
    },
    {
      key: "fee",
      label: "Price",
      render: (row: DocumentTypeView) => editingId === row.id ? (
        <Input
          type="number"
          min={0}
          max={999999.99}
          step="0.01"
          value={editing.fee}
          onChange={(event) => {
            const fee = Number(event.target.value);
            // Keep intermediate input out of the draft: "" coerces to 0 and
            // "-" to NaN, so only finite non-negative numbers land in state.
            setEditing({ ...editing, fee: Number.isFinite(fee) && fee >= 0 ? fee : editing.fee });
          }}
          className="w-28"
        />
      ) : formatDocumentFee(row.fee),
    },
    {
      key: "status",
      label: "Status",
      render: (row: DocumentTypeView) => (
        <span className={row.isActive ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800" : "inline-flex items-center gap-1.5 rounded-full bg-slate-300/70 px-2.5 py-1 text-xs font-medium text-slate-700"}>
          <span className={row.isActive ? "h-1.5 w-1.5 rounded-full bg-emerald-500" : "h-1.5 w-1.5 rounded-full bg-slate-500"} aria-hidden />
          {row.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: DocumentTypeView) => editingId === row.id ? (
        <div className="grid w-fit grid-cols-2 gap-2">
          <Button type="button" size="sm" className="w-28" tone="success" onClick={() => save(row.id)} loading={busy}>Save</Button>
          <Button type="button" size="sm" className="w-28" tone="secondary" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
        </div>
      ) : (
        <div className="flex w-fit items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="w-28"
            tone="secondary"
            disabled={busy || !row.isActive}
            onClick={() => {
              setEditingId(row.id);
              setEditing({
                name: row.name,
                description: row.description,
                requirements: row.requirements,
                processingDays: row.processingDays,
                fee: row.fee,
                isActive: row.isActive,
              });
            }}
          >Edit</Button>
          {row.isActive ? <Button type="button" size="sm" className="w-28 bg-red-700 hover:bg-red-800 focus-visible:outline-red-700" tone="danger" onClick={() => deactivate(row.id)} disabled={busy}>Deactivate</Button> : <Button type="button" size="sm" className="w-28" tone="success" onClick={() => enable(row)} disabled={busy}>Enable</Button>}
          <Button
            type="button"
            size="sm"
            className="w-28 text-red-900 hover:bg-red-50 hover:text-red-950"
            tone="ghost"
            aria-label={`Delete ${row.name}`}
            title={`Delete ${row.name}`}
            onClick={() => setDeleteTarget(row)}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" tone="success" onClick={() => setCreateOpen(true)}>Add type</Button>
      </div>
      <Modal
        open={createOpen}
        onClose={() => {
          if (busy) return;
          setCreateOpen(false);
          setDraft(blankDraft);
        }}
        title="Add document type"
        description="Add a request option and set its processing time and fee."
      >
        <form onSubmit={create} className="space-y-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Name <Required /></span><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={120} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Processing days <Required /></span><Input type="number" min={0} max={365} value={draft.processingDays} onChange={(event) => {
              const days = Number(event.target.value);
              setDraft({ ...draft, processingDays: Number.isFinite(days) && days >= 0 ? days : draft.processingDays });
            }} required /></label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Price (PHP)</span><Input type="number" min={0} max={999999.99} step="0.01" value={draft.fee} onChange={(event) => {
              const fee = Number(event.target.value);
              setDraft({ ...draft, fee: Number.isFinite(fee) && fee >= 0 ? fee : draft.fee });
            }} /></label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" tone="secondary" onClick={() => { setCreateOpen(false); setDraft(blankDraft); }} disabled={busy}>Cancel</Button>
            <Button type="submit" tone="success" loading={busy}>Add type</Button>
          </div>
        </form>
      </Modal>
      <DataTable title="Document types" rows={types}
        rowClassName={(row) => (row.isActive ? undefined : "bg-slate-200/70")}
        columns={columns}
        emptyMessage="No document types found. Run npm run db:seed or add document types."
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this document type?"
        message="This permanently removes the document type. Types linked to existing requests cannot be deleted; deactivate those instead."
        confirmLabel="Delete type"
        tone="danger"
        loading={busy}
        onConfirm={removeDocumentType}
        onCancel={() => { if (!busy) setDeleteTarget(null); }}
      >
        {deleteTarget ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">{deleteTarget.name}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
