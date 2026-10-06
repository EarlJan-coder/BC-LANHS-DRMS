# PDF Watermark — Centered Logo on Slip and Certificate

**Date:** 2026-10-07
**Status:** Approved, ready for implementation

## Goal

Add a centered, low-opacity logo watermark to both the document request slip PDF and the certificate PDF, using the existing school logo asset.

## Scope

- **In scope:** shared `drawWatermark` helper in `pdf-brand.ts`; call it from `renderRequestSlipPdf` and the certificate renderer.
- **Out of scope:** any API, DB, schema, or UI changes; certificate or slip visual output other than the watermark.

## Design

### Shared helper: `src/lib/services/pdf-brand.ts`

```ts
export const WATERMARK_SIZE = 280;
export const WATERMARK_OPACITY = 0.08;

export function drawWatermark(page: PDFPage, logo: PDFImage | null) {
  if (!logo) return;
  page.drawImage(logo, {
    x: (PAGE_WIDTH - WATERMARK_SIZE) / 2,   // 157.64
    y: (PAGE_HEIGHT - WATERMARK_SIZE) / 2,  // 280.945
    width: WATERMARK_SIZE,
    height: WATERMARK_SIZE,
    opacity: WATERMARK_OPACITY,
  });
}
```

- Logo is 448×448 (square), so a square 280×280 draw preserves aspect.
- Dead center of A4 page (595.28 × 841.89).
- 8% opacity = subtle watermark visible over text and panels without harming readability.
- No-op when logo missing (consistent with existing `embedSchoolLogo` fallback behavior).

### Slip: `src/lib/services/document-requests.ts`

In `renderRequestSlipPdf`, add a single call at the very end, just before `return pdfDoc.save()`:

```ts
drawWatermark(page, logo);
```

`logo` is already in scope (line 202).

### Certificate: `src/lib/services/certificates.ts`

In the main certificate render function, add the call immediately before `return Buffer.from(await pdf.save())` (after `drawCertificateFooter`):

```ts
drawWatermark(page, logo);
```

`logo` is already in scope (line 459).

## Z-order rationale

Both PDFs draw white-filled rectangles over the page center (slip details panel y≈418–548; certificate body rect y=250–550). Drawing the watermark **last (on top)** at 8% opacity ensures it's visible across panels and text — the classic watermark look. Drawing it first would hide it behind the white panels.

## Edge cases

- **Missing logo file:** helper returns early; no watermark, no error (matches existing header fallback).
- **Opacity tuning:** single constant `WATERMARK_OPACITY`; adjust if visual inspection suggests too strong/faint.

## Verification

1. `npx tsc --noEmit` — no type errors.
2. `npm run lint` — passes.
3. `GET /api/certificates/{id}/pdf` — open PDF: watermark centered, faint, text readable, layout otherwise unchanged.
4. `GET /api/document-requests/{id}/slip` — same check.