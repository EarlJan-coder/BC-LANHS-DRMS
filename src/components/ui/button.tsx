import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { LinkPendingContent } from "@/components/ui/pending-link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ButtonTone = "primary" | "secondary" | "ghost" | "success" | "info" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

/** Semantic tones: success = commit/approve, info = files & system ops, danger = destructive. */
const tones: Record<ButtonTone, string> = {
  primary: "bg-brand text-white shadow-sm shadow-rose-950/10 hover:bg-brand-dark focus-visible:outline-brand",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-950/[0.02] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-brand",
  ghost: "text-slate-700 hover:bg-rose-50 hover:text-brand focus-visible:outline-brand",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-900/10 hover:bg-emerald-700 focus-visible:outline-emerald-600",
  info: "bg-blue-600 text-white shadow-sm shadow-blue-900/10 hover:bg-blue-700 focus-visible:outline-blue-600",
  danger: "bg-red-900 text-white shadow-sm hover:bg-red-950 focus-visible:outline-red-900",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
  icon: "h-10 w-10 p-0",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function Button({
  className,
  tone = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      aria-busy={loading || undefined}
      className={cn(
        base,
        tones[tone],
        sizes[size],
        loading && "disabled:opacity-100",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  className,
  tone = "primary",
  size = "md",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link className={cn(base, tones[tone], sizes[size], className)} prefetch={false} {...props}>
      {size === "icon" ? (
        <LinkPendingContent icon={children} />
      ) : (
        <LinkPendingContent>{children}</LinkPendingContent>
      )}
    </Link>
  );
}

