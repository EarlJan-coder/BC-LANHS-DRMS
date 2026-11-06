"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Inline pending feedback for a next/link navigation.
 * MUST render as a descendant of a <Link> (useLinkStatus requirement).
 *
 * Convention: while pending the icon slot swaps to a Spinner and the label
 * dims; with no icon, a Spinner appears before the label. aria-busy lands on
 * the content wrapper — it cannot reach the anchor from a descendant.
 */
export function LinkPendingContent({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-busy={pending || undefined}
      className={cn("inline-flex min-w-0 items-center gap-2", className)}
    >
      {icon !== undefined ? (
        <span className="inline-flex shrink-0 items-center justify-center">
          {pending ? <Spinner /> : icon}
        </span>
      ) : pending ? (
        <Spinner />
      ) : null}
      {children != null ? (
        <span className={cn("min-w-0", pending && "opacity-60")}>{children}</span>
      ) : null}
    </span>
  );
}

/**
 * Link with inline click feedback in the app's spinner convention.
 * For icon-only usage set iconOnly: the Spinner replaces the icon while
 * pending and `label` serves as the link's accessible name.
 */
export function PendingLink({
  href,
  icon,
  label,
  iconOnly = false,
  className,
}: {
  href: string;
  icon?: ReactNode;
  label: string;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} prefetch={false} aria-label={label} className={className}>
      <LinkPendingContent icon={icon}>
        {iconOnly ? undefined : <span>{label}</span>}
      </LinkPendingContent>
    </Link>
  );
}
