"use client";

import { FileBadge } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";

export function GenerateCertificateButton({
  requestId,
  documentType,
  certificateGenerated = false,
}: {
  requestId: string;
  documentType: string;
  certificateGenerated?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, certificateType: documentType }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to generate certificate.");
        return;
      }

      toast.success("Certificate generated.");
      setConfirmOpen(false);
      router.push(`/registrar/certificates/${data.id}`);
      router.refresh();
    } catch {
      toast.error("Unable to generate certificate. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        type="button"
        tone="success"
        onClick={() => setConfirmOpen(true)}
        loading={loading}
        disabled={certificateGenerated}
      >
        {loading ? null : <FileBadge className="h-4 w-4" aria-hidden />}
        {loading ? "Generating…" : "Generate certificate"}
      </Button>
      {certificateGenerated ? (
        <p className="text-sm text-slate-500">
          A certificate has already been generated for this request.
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Generate certificate?"
        message={`A downloadable ${documentType} PDF will be generated for this request.`}
        confirmLabel="Generate"
        loading={loading}
        onConfirm={generate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
