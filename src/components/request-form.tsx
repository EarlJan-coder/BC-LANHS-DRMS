"use client";

import { FilePlus } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DOCUMENT_TYPES } from "@/lib/constants";

export function RequestForm() {
  const [loading, setLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingFormRef = useRef<FormData | null>(null);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pendingFormRef.current = new FormData(event.currentTarget);
    setConfirmOpen(true);
  }

  async function submitRequest() {
    const formData = pendingFormRef.current;
    if (!formData) {
      return;
    }

    setLoading(true);
    setTrackingNumber(null);

    try {
      const response = await fetch("/api/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: formData.get("documentType"),
          purpose: formData.get("purpose"),
          schoolYearNeeded: formData.get("schoolYearNeeded"),
          gradeLevelNeeded: formData.get("gradeLevelNeeded"),
          remarks: formData.get("remarks"),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to submit request.");
        return;
      }

      setTrackingNumber(data.trackingNumber);
      toast.success("Document request submitted.");
      setConfirmOpen(false);
    } catch {
      toast.error("Unable to submit request. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Document request form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="documentType">Document type</Label>
              <Select id="documentType" name="documentType" required defaultValue="">
                <option value="" disabled>
                  Select document type
                </option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purpose">Request purpose</Label>
              <Textarea
                id="purpose"
                name="purpose"
                required
                placeholder="Example: College scholarship application, transfer requirement, enrollment verification"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="schoolYearNeeded">School year needed</Label>
                <Input id="schoolYearNeeded" name="schoolYearNeeded" required placeholder="2026-2027" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gradeLevelNeeded">Grade level needed</Label>
                <Input id="gradeLevelNeeded" name="gradeLevelNeeded" required placeholder="Grade 12" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pickupMode">Preferred release mode</Label>
                <Input id="pickupMode" value="Registrar pickup" readOnly />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="processingNote">Processing note</Label>
                <Input id="processingNote" value="Subject to registrar validation" readOnly />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remarks">Additional remarks</Label>
              <Textarea id="remarks" name="remarks" placeholder="Optional details for the registrar" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" loading={loading}>
                {loading ? null : <FilePlus className="h-4 w-4" aria-hidden />}
                {loading ? "Submitting…" : "Submit request"}
              </Button>
              {trackingNumber ? (
                <span className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-brand ring-1 ring-rose-100">
                  Tracking number: {trackingNumber}
                </span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmOpen}
        title="Submit this document request?"
        message="It will be sent to the registrar for processing."
        confirmLabel="Submit request"
        loading={loading}
        onConfirm={submitRequest}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
