import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-rose-100";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-28 resize-y", className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-slate-700", className)} {...props} />;
}

/**
 * Marks a required field label.
 *
 * Pair with a control that carries the `required` attribute — that attribute is
 * what actually stops the browser submitting an empty value, so the two must
 * always be shown together. The `*` is hidden from assistive technology because
 * the control's own `required` is what gets announced.
 */
export function Required() {
  return (
    <span className="text-red-600" aria-hidden="true">
      *
    </span>
  );
}

