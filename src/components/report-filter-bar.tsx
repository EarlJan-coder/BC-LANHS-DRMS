"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { REQUEST_STATUSES } from "@/lib/constants";

type FilterValues = {
  from: string;
  to: string;
  documentType: string;
  status: string;
};

/** Period + document type + status filters for the registrar reports page.
 *
 * The URL is the single source of truth: every change navigates with
 * `router.replace`, so filtered views are linkable and back/forward works.
 * Changing a filter drops every `page-*` param on purpose — old page numbers
 * are meaningless for the new result set. */
export function ReportFilterBar({
  initialFrom,
  initialTo,
  initialDocumentType,
  initialStatus,
  periodLabel,
  documentTypes,
}: {
  initialFrom?: string;
  initialTo?: string;
  initialDocumentType?: string;
  initialStatus?: string;
  periodLabel: string;
  documentTypes: string[];
}) {
  // Keyed by the URL-derived values so navigations that change the query
  // (incl. history back to an unfiltered URL) remount the fields instead of
  // leaving stale local state behind.
  return (
    <ReportFilterFields
      key={`${initialFrom ?? ""}|${initialTo ?? ""}|${initialDocumentType ?? ""}|${initialStatus ?? ""}`}
      initialFrom={initialFrom}
      initialTo={initialTo}
      initialDocumentType={initialDocumentType}
      initialStatus={initialStatus}
      periodLabel={periodLabel}
      documentTypes={documentTypes}
    />
  );
}

function ReportFilterFields({
  initialFrom,
  initialTo,
  initialDocumentType,
  initialStatus,
  periodLabel,
  documentTypes,
}: {
  initialFrom?: string;
  initialTo?: string;
  initialDocumentType?: string;
  initialStatus?: string;
  periodLabel: string;
  documentTypes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [documentType, setDocumentType] = useState(initialDocumentType ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [isPending, startTransition] = useTransition();

  const statusLabel =
    REQUEST_STATUSES.find((item) => item.value === status)?.label ?? status;
  const hasFilters = Boolean(from || to || documentType || status);

  function apply(next: FilterValues) {
    const params = new URLSearchParams();
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.documentType) params.set("documentType", next.documentType);
    if (next.status) params.set("status", next.status);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }

  function update(patch: Partial<FilterValues>) {
    const next: FilterValues = { from, to, documentType, status, ...patch };
    setFrom(next.from);
    setTo(next.to);
    setDocumentType(next.documentType);
    setStatus(next.status);
    apply(next);
  }

  function clear() {
    update({ from: "", to: "", documentType: "", status: "" });
  }

  // Keep a selected type visible even if the catalogue no longer lists it
  // (e.g. a stale bookmarked URL) so the select never shows a blank value.
  const typeOptions =
    documentType && !documentTypes.includes(documentType)
      ? [documentType, ...documentTypes]
      : documentTypes;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            disabled={isPending}
            onChange={(event) => update({ from: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            disabled={isPending}
            onChange={(event) => update({ to: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-document-type">Document type</Label>
          <Select
            id="report-document-type"
            value={documentType}
            disabled={isPending}
            onChange={(event) => update({ documentType: event.target.value })}
          >
            <option value="">All document types</option>
            {typeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-status">Status</Label>
          <Select
            id="report-status"
            value={status}
            disabled={isPending}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {REQUEST_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500">
          {isPending ? <Spinner className="h-3.5 w-3.5" /> : null}
          <span>
            Showing <span className="font-medium text-slate-700">{periodLabel}</span>
          </span>
          {documentType ? (
            <FilterChip
              label={documentType}
              ariaLabel={`Remove document type filter (${documentType})`}
              disabled={isPending}
              onRemove={() => update({ documentType: "" })}
            />
          ) : null}
          {status ? (
            <FilterChip
              label={statusLabel}
              ariaLabel={`Remove status filter (${statusLabel})`}
              disabled={isPending}
              onRemove={() => update({ status: "" })}
            />
          ) : null}
        </div>
        {hasFilters ? (
          <Button type="button" tone="ghost" size="sm" onClick={clear} disabled={isPending}>
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  ariaLabel,
  disabled,
  onRemove,
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-700 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50"
    >
      {label}
      <X className="h-3 w-3" aria-hidden />
    </button>
  );
}
