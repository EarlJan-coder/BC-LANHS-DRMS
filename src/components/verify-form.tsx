"use client";

import { SearchCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent } from "react";
import { QrScanButton } from "@/components/qr-scan-button";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function VerifyForm({ certificateNumber = "", trackingNumber = "" }: { certificateNumber?: string; trackingNumber?: string }) {
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const certificate = String(form.get("certificateNumber") ?? "").trim();
    const tracking = String(form.get("trackingNumber") ?? "").trim();
    if (certificate) params.set("certificateNumber", certificate);
    if (tracking) params.set("trackingNumber", tracking);
    if (params.size) router.push(`/verify?${params.toString()}`);
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="verify-certificate-number">Certificate no.</Label>
          <Input id="verify-certificate-number" name="certificateNumber" autoComplete="off" placeholder="e.g. CERT-2026-001" defaultValue={certificateNumber} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="verify-tracking-number">Tracking no.</Label>
          <Input id="verify-tracking-number" name="trackingNumber" autoComplete="off" placeholder="e.g. LANHS-20261126-AB123" defaultValue={trackingNumber} />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          <SearchCheck className="h-4 w-4" aria-hidden />
          Verify document
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or scan a code</div>
      <QrScanButton />
    </div>
  );
}
