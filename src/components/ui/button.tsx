import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const tones: Record<ButtonTone, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-dark focus-visible:outline-brand",
  secondary: "border border-border bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-brand",
  ghost: "text-slate-700 hover:bg-rose-50 hover:text-brand focus-visible:outline-brand",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10 p-0",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function Button({
  className,
  tone = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone; size?: ButtonSize }) {
  return <button className={cn(base, tones[tone], sizes[size], className)} {...props} />;
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
      {children}
    </Link>
  );
}

