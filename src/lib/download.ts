/**
 * Parse a download filename out of a Content-Disposition header.
 *
 * Follows RFC 6266: `filename*` (RFC 5987, percent-encoded) takes precedence
 * over plain `filename`. Path components are stripped so a hostile header can
 * never suggest a directory to the browser's save dialog.
 */
export function filenameFromContentDisposition(
  header: string | null | undefined,
): string | undefined {
  if (!header) return undefined;

  const extended = /;\s*filename\*\s*=\s*([^';]+)'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    return sanitizeFilename(decodeExtendedValue(extended[2]));
  }

  const quoted = /;\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted) {
    // No general quoted-pair unescaping: browsers treat backslashes in
    // Content-Disposition filenames as path separators (Windows paths).
    return sanitizeFilename(quoted[1]);
  }

  const bare = /;\s*filename\s*=\s*([^;]+)/i.exec(header);
  if (bare) {
    return sanitizeFilename(bare[1]);
  }

  return undefined;
}

/**
 * Pick the toast message for a failed download: the server's own error body
 * (e.g. proxy 401 "Please sign in to continue.") beats a generic status text.
 */
export function downloadErrorMessage(status: number, body: unknown): string {
  const message = (body as { error?: unknown } | null)?.error;
  if (typeof message === "string" && message) {
    return message;
  }
  return `Download failed (HTTP ${status}). Please try again.`;
}

function decodeExtendedValue(value: string): string {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

function sanitizeFilename(name: string): string | undefined {
  const base = name.trim().split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return undefined;
  return cleaned;
}
