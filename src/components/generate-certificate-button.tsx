"use client";

import { FileBadge } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function GenerateCertificateButton({
  requestId,
  documentType,
}: {
  requestId: string;
  documentType: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!window.confirm(`Generate a downloadable ${documentType} PDF for this request?`)) {
      return;
    }

    setLoading(true);
    const response = await fetch("/api/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, certificateType: documentType }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to generate certificate.");
      return;
    }

    toast.success("Certificate generated.");
    router.push(`/registrar/certificates/${data.id}`);
    router.refresh();
  }

  return (
    <Button type="button" onClick={generate} disabled={loading}>
      <FileBadge className="h-4 w-4" aria-hidden />
      {loading ? "Generating" : "Generate certificate"}
    </Button>
  );
}
