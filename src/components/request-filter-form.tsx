"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PendingForm } from "@/components/ui/pending-form";
import { REQUEST_STATUSES } from "@/lib/constants";

/** Shared GET filter form for the registrar and student request lists. */
export function RequestFilterForm({
  className,
  queryPlaceholder,
  initialQuery = "",
  initialStatus = "",
  initialDocumentType = "",
  showDocumentType = false,
}: {
  className?: string;
  queryPlaceholder: string;
  initialQuery?: string;
  initialStatus?: string;
  initialDocumentType?: string;
  showDocumentType?: boolean;
}) {
  return (
    <PendingForm className={className}>
      {({ isPending }) => (
        <>
          <div className="grid gap-2">
            <Label htmlFor="q">Search</Label>
            <Input id="q" name="q" defaultValue={initialQuery} placeholder={queryPlaceholder} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={initialStatus}>
              <option value="">All statuses</option>
              {REQUEST_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          {showDocumentType ? (
            <div className="grid gap-2">
              <Label htmlFor="documentType">Document type</Label>
              <Input
                id="documentType"
                name="documentType"
                defaultValue={initialDocumentType}
                placeholder="Certificate"
              />
            </div>
          ) : null}
          <Button type="submit" loading={isPending}>
            {isPending ? "Applying…" : "Filter"}
          </Button>
        </>
      )}
    </PendingForm>
  );
}
