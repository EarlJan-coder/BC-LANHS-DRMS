"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RetryBlockchainButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    try {
      const response = await fetch("/api/blockchain/retry", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to retry blockchain proofs.");
        return;
      }

      toast.success(`Retried ${data.retry.attempted} proof(s), submitted ${data.retry.submitted}.`);
      router.refresh();
    } catch {
      toast.error("Unable to retry blockchain proofs. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" tone="secondary" onClick={retry} loading={loading}>
      {loading ? null : <RotateCw className="h-4 w-4" aria-hidden />}
      {loading ? "Retrying…" : "Retry pending proofs"}
    </Button>
  );
}
