"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonSize, type ButtonTone } from "@/components/ui/button";
import { filenameFromContentDisposition } from "@/lib/download";

/**
 * Attachment-download button with in-flight feedback.
 *
 * Fetches the target as a blob and saves it via a temporary anchor, so the
 * button can show a spinner while slow server-side generation runs and report
 * real errors (401/404/500) instead of navigating to an error body.
 * Keep plain links for anything that should open in a tab (e.g. `?inline` PDF
 * previews) — this component is for true downloads only.
 */
export function DownloadButton({
  href,
  filename,
  tone = "secondary",
  size = "md",
  loadingLabel = "Downloading…",
  className,
  children,
  ...props
}: {
  href: string;
  filename?: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  loadingLabel?: string;
  className?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "disabled">) {
  const [pending, setPending] = useState(false);

  async function download() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) {
        toast.error(`Download failed (HTTP ${response.status}). Please try again.`);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        filename ??
        filenameFromContentDisposition(response.headers.get("content-disposition")) ??
        "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={download}
      loading={pending}
      tone={tone}
      size={size}
      className={className}
      {...props}
    >
      {/* Icon-only buttons keep their square shape: the Spinner alone replaces the icon. */}
      {pending ? (size === "icon" ? null : loadingLabel) : children}
    </Button>
  );
}
