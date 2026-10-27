"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  /** When set, renders a required reason textarea (reject flow). */
  reason?: {
    label: string;
    placeholder?: string;
    defaultValue?: string;
  };
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  children?: ReactNode;
}

/**
 * Mounted only while `open`, so its state initializes fresh on every open
 * (no reset-in-effect) and unmounts entirely on close.
 */
function ConfirmDialogPanel({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading = false,
  reason,
  onConfirm,
  onCancel,
  children,
}: Omit<ConfirmDialogProps, "open">) {
  const [reasonValue, setReasonValue] = useState(reason?.defaultValue ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the reason field when present, otherwise the confirm button.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const container = dialogRef.current;
      const target = reason
        ? container?.querySelector<HTMLTextAreaElement>("#confirm-dialog-reason")
        : container?.querySelector<HTMLButtonElement>("[data-confirm]");
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reason]);

  // Escape closes the dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const reasonRequired = Boolean(reason);
  const canConfirm = !reasonRequired || reasonValue.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={loading ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>

        {children}

        {reason ? (
          <div className="mt-4">
            <label htmlFor="confirm-dialog-reason" className="block text-sm font-medium text-slate-700">
              {reason.label}
            </label>
            <textarea
              id="confirm-dialog-reason"
              value={reasonValue}
              onChange={(event) => setReasonValue(event.target.value)}
              placeholder={reason.placeholder}
              rows={3}
              disabled={loading}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" tone="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            data-confirm="true"
            tone={tone}
            loading={loading}
            disabled={!canConfirm}
            onClick={() => onConfirm(reasonValue.trim())}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  if (!open) {
    return null;
  }
  return <ConfirmDialogPanel {...props} />;
}
