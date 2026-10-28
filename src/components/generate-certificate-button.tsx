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
}: {
  requestId: string;
  documentType: string;
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
    <>
      <Button type="button" onClick={() => setConfirmOpen(true)} loading={loading}>
        {loading ? null : <FileBadge className="h-4 w-4" aria-hidden />}
        {loading ? "Generating…" : "Generate certificate"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Generate certificate?"
        message={`A downloadable ${documentType} PDF will be generated for this request.`}
        confirmLabel="Generate"
        loading={loading}
        onConfirm={generate}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
