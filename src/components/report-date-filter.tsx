"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function ReportDateFilter({
  initialFrom,
  initialTo,
  periodLabel,
}: {
  initialFrom?: string;
  initialTo?: string;
  periodLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [isPending, startTransition] = useTransition();

  function apply(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }

  function clear() {
    setFrom("");
    setTo("");
    apply("", "");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            disabled={isPending}
            onChange={(event) => {
              const value = event.target.value;
              setFrom(value);
              apply(value, to);
            }}
            className="mt-1 w-[10.5rem]"
          />
        </div>
        <div>
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            disabled={isPending}
            onChange={(event) => {
              const value = event.target.value;
              setTo(value);
              apply(from, value);
            }}
            className="mt-1 w-[10.5rem]"
          />
        </div>
        <Button type="button" tone="ghost" onClick={clear} disabled={isPending}>
          Clear
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        {isPending ? <Spinner className="h-3 w-3" /> : null}
        Showing: {periodLabel}
      </p>
    </div>
  );
}
