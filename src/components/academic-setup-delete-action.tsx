"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

export type AcademicSetupEntity = "school-years" | "grade-levels" | "sections" | "document-types";

const entityCopy: Record<AcademicSetupEntity, { noun: string; dialogMessage: string }> = {
  "school-years": {
    noun: "school year",
    dialogMessage:
      "This can't be undone. School years with linked sections, students, or certificates cannot be deleted.",
  },
  "grade-levels": {
    noun: "grade level",
    dialogMessage: "This can't be undone. Grade levels with linked sections or students cannot be deleted.",
  },
  sections: {
    noun: "section",
    dialogMessage: "This can't be undone. Sections with linked students cannot be deleted.",
  },
  "document-types": {
    noun: "document type",
    dialogMessage: "This can't be undone. Document types with linked document requests cannot be deleted.",
  },
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DeleteSetupAction({
  entity,
  id,
  name,
}: {
  entity: AcademicSetupEntity;
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const copy = entityCopy[entity];

  async function onDelete() {
    setDeleting(true);

    try {
      const response = await fetch(`/api/academic-setup/${entity}/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        toast.error(data.error ?? `Unable to delete ${copy.noun}.`);
        return;
      }

      toast.success(`${capitalize(copy.noun)} deleted.`);
      setConfirmDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error(`Unable to delete ${copy.noun}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        tone="danger"
        size="sm"
        onClick={() => setConfirmDeleteOpen(true)}
        loading={deleting}
        disabled={deleting}
        aria-label={`Delete ${name}`}
      >
        {deleting ? null : <Trash2 className="h-4 w-4" aria-hidden />}
        {deleting ? "Deleting…" : "Delete"}
      </Button>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete this ${copy.noun}?`}
        message={copy.dialogMessage}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
