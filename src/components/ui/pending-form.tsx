"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useTransition,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";
import { formSubmitHref } from "@/lib/pending-form";

/**
 * GET form wrapper with pending feedback.
 *
 * Submits exactly like the native GET form it replaces (same query-string
 * semantics, so server pages are untouched) but navigates client-side inside a
 * transition, exposing `isPending` to the submit button via a render prop.
 * Without JavaScript the form still submits natively.
 */
export function PendingForm({
  action,
  className,
  children,
  onSubmit,
  ...props
}: {
  action?: string;
  className?: string;
  children: ReactNode | ((props: { isPending: boolean }) => ReactNode);
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "method" | "onSubmit" | "children">) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    const form = event.currentTarget;
    const entries: Array<[string, string]> = [];
    new FormData(form).forEach((value, name) => {
      if (typeof value === "string") entries.push([name, value]);
    });
    const href = formSubmitHref(action ?? pathname, entries);
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <form
      {...props}
      className={className}
      method="get"
      action={action ?? undefined}
      aria-busy={isPending || undefined}
      onSubmit={handleSubmit}
    >
      {typeof children === "function" ? children({ isPending }) : children}
    </form>
  );
}
