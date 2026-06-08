"use client";

import { RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RetryBlockchainButton() {
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    const response = await fetch("/api/blockchain/retry", { method: "POST" });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to retry blockchain proofs.");
      return;
    }

    toast.success(`Retried ${data.retry.attempted} proof(s), submitted ${data.retry.submitted}.`);
  }

  return (
    <Button type="button" tone="secondary" onClick={retry} disabled={loading}>
      <RotateCw className="h-4 w-4" aria-hidden />
      {loading ? "Retrying" : "Retry pending proofs"}
    </Button>
  );
}
