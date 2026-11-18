import type { ReactNode } from "react";
import { Button, type ButtonSize, type ButtonTone } from "@/components/ui/button";
import { DownloadButton } from "@/components/ui/download-button";
import { SLIP_DOWNLOAD_HINT, SLIP_DOWNLOAD_STATUS } from "@/lib/constants";
import type { RequestStatus } from "@/db/schema";

/**
 * Request-slip download used across the student portal.
 *
 * Students may only download a slip once the request is Ready for Pickup —
 * the server enforces the same rule in `canAccessRequestSlip`, this just
 * keeps the UI honest: before that the control stays visible but disabled,
 * with `SLIP_DOWNLOAD_HINT` as its hover tooltip (and in its accessible name
 * for icon-only buttons).
 *
 * The locked state wraps a native-disabled `Button` in a `title`-bearing
 * span on purpose: `Button`'s base class sets `disabled:pointer-events-none`,
 * so a native disabled button swallows its own tooltip — the wrapper receives
 * the pointer events instead, while the button itself stays inert and dimmed.
 */
export function SlipDownloadButton({
  status,
  href,
  ariaLabel,
  tone = "info",
  size = "md",
  className,
  loadingLabel,
  children,
}: {
  status: RequestStatus;
  href: string;
  ariaLabel?: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (status === SLIP_DOWNLOAD_STATUS) {
    return (
      <DownloadButton
        href={href}
        tone={tone}
        size={size}
        className={className}
        loadingLabel={loadingLabel}
        aria-label={ariaLabel}
      >
        {children}
      </DownloadButton>
    );
  }

  return (
    <span title={SLIP_DOWNLOAD_HINT} className="inline-flex cursor-not-allowed">
      <Button
        type="button"
        disabled
        tone={tone}
        size={size}
        className={className}
        aria-label={ariaLabel ? `${ariaLabel} — ${SLIP_DOWNLOAD_HINT}` : undefined}
      >
        {children}
      </Button>
    </span>
  );
}
