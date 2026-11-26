"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, type ButtonTone } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonTone;
  loading?: boolean;
  /** When set, renders a required reason control (reject/decline flows).
   * Pass `options` for a dropdown of predefined choices — "Other" is appended
   * automatically and reveals a required text field for custom reasons. */
  reason?: {
    label: string;
    /** Predefined choices. Without it, a plain required textarea renders. */
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
  };
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** Sentinel option appended after every predefined reason list. */
const OTHER_REASON = "Other";

/**
 * Mounted only while `open`, so its state initializes fresh on every open
 * (no reset-in-effect) and unmounts entirely on close.
 */
function ConfirmDialogPanel({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "success",
  loading = false,
  reason,
  onConfirm,
  onCancel,
  children,
}: Omit<ConfirmDialogProps, "open">) {
  const reasonOptions = reason?.options;
  // Primitive focus key: `reason` is an object literal from the caller, so it
  // changes identity on every parent render and would re-steal focus.
  const reasonMode = !reason ? "none" : reason.options ? "choice" : "text";
  const [reasonValue, setReasonValue] = useState(reason?.defaultValue ?? "");
  const [selectedChoice, setSelectedChoice] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const choosingOther = selectedChoice === OTHER_REASON;
  const trimmedReason = reasonValue.trim();

  // Focus the reason control when present, otherwise the confirm button.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const container = dialogRef.current;
      const target =
        reasonMode === "choice"
          ? container?.querySelector<HTMLElement>("#confirm-dialog-reason-choice")
          : reasonMode === "text"
            ? container?.querySelector<HTMLElement>("#confirm-dialog-reason")
            : container?.querySelector<HTMLButtonElement>("[data-confirm]");
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reasonMode]);

  // Picking "Other" reveals the custom-reason textarea; drop the caret in it.
  useEffect(() => {
    if (!choosingOther) return;
    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("#confirm-dialog-reason")?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [choosingOther]);

  // Escape closes the dialog, but not while a confirm action is in flight
  // (same gating as the backdrop and cancel button). Tab is trapped inside
  // the dialog: without a trap, keyboard focus can walk out of the overlay
  // into the surrounding page (e.g. a row's inputs and Save button when the
  // dialog is nested in a form) and Enter there fires that form's submit
  // while this dialog is open. The trap also makes aria-modal truthful.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const container = dialogRef.current;
      if (!container) {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active: Element | null = document.activeElement;

      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, loading]);

  const reasonRequired = Boolean(reason);
  const canConfirm =
    !reasonRequired ||
    (reasonOptions
      ? selectedChoice !== "" && (!choosingOther || trimmedReason.length > 0)
      : trimmedReason.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={loading ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
      >
        <div className={tone === "danger" ? "flex items-start gap-3 border-b border-red-200 bg-red-50/80 px-5 py-5 sm:px-6" : "flex items-start gap-3 border-b border-border bg-slate-50/80 px-5 py-5 sm:px-6"}>
          <span className={tone === "danger" ? "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-900" : "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-700"}>
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        {children ? <div className="px-5 pt-4 sm:px-6">{children}</div> : null}

        {reason ? (
          <div className="px-5 pt-4 sm:px-6">
            <label
              htmlFor={reasonOptions ? "confirm-dialog-reason-choice" : "confirm-dialog-reason"}
              className="block text-sm font-medium text-slate-700"
            >
              {reason.label}
            </label>
            {reasonOptions ? (
              <select
                id="confirm-dialog-reason-choice"
                value={selectedChoice}
                onChange={(event) => {
                  setSelectedChoice(event.target.value);
                  if (event.target.value !== OTHER_REASON) {
                    setReasonValue("");
                  }
                }}
                disabled={loading}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="" disabled>
                  Select a reason…
                </option>
                {reasonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value={OTHER_REASON}>{OTHER_REASON}</option>
              </select>
            ) : (
              <textarea
                id="confirm-dialog-reason"
                value={reasonValue}
                onChange={(event) => setReasonValue(event.target.value)}
                placeholder={reason.placeholder}
                rows={3}
                disabled={loading}
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            )}
            {reasonOptions && choosingOther ? (
              <>
                <label
                  htmlFor="confirm-dialog-reason"
                  className="mt-3 block text-sm font-medium text-slate-700"
                >
                  Specific reason (required)
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
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-border bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" tone="secondary" className="w-full sm:w-auto sm:min-w-28" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            data-confirm="true"
            tone={tone}
            loading={loading}
            disabled={!canConfirm}
            className="w-full sm:w-auto sm:min-w-32"
            onClick={() =>
              onConfirm(
                reasonOptions ? (choosingOther ? trimmedReason : selectedChoice) : trimmedReason,
              )
            }
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
