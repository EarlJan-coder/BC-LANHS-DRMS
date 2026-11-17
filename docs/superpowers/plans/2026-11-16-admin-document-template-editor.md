# Admin Document Template Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin edit each certificate's title, body wording, and signatory titles with a live PDF preview, and fix word/value spacing on every certificate.

**Architecture:** The generated per-character layouts keep rendering the header, footer, decor, and signature blocks verbatim. The body region (title line +1 through the line before the first signatory) is always re-typeset from editable wording text (default or saved override) with natural spaces, justified to the same margins, `{{placeholders}}` filled bold/underlined — this is what fixes the spacing bugs. Titles and signatory titles stay verbatim until edited. Wording overrides live in a new `document_template_wording` table (per-field null = default); the admin UI previews via a draft-render endpoint.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM + PostgreSQL, pdf-lib + @pdf-lib/fontkit, Zod 4, Tailwind, sonner, `node:test` + tsx.

**Spec:** Approved design (this session); key points restated in "Design summary" below. One refinement vs the design text: body/title/signatory regions are *derived from the generated layout at runtime* (with a drift check) instead of a hand-pinned index overlay — same behavior, and it removes the drift risk the builder review flagged.

## Design summary (traveling spec)

- Five templates (`good-moral`, `good-moral-jhs`, `enrolment-jhs`, `enrolment-shs`, `graduation`) each get editable: `title`, `body`, `principalTitle`, `registrarTitle`. Shared, unchanged: principal/registrar **names** (`document_signatory_template`).
- Placeholders (fixed set): `{{name}} {{grade}} {{schoolYear}} {{lrn}} {{purpose}} {{day}} {{month}}`. Values render bold with a 0.7pt underline beneath (y = baseline − 2.11). Empty values render an underscore run tiling the field's slot width. `**text**` in body renders bold (preserves "GRADUATE"); unbalanced `**` is literal.
- Body is **always typeset** (even unedited) — this is the spacing fix ("year2025-2026" → "year 2025-2026", "____,is" → "____, is"). Titles/signatory titles render verbatim from layout tokens until their wording differs from the default.
- Defaults are transcribed from the school's reference PDFs; **"School Counselor Associate 1" keeps the "1"**.
- Editing saves only fields that differ from defaults (per-column null = default). Reset deletes the row. Edits apply to all future renders including re-downloads of issued certificates (stakeholder-approved).
- Admin-only APIs; registrar per-certificate editor untouched; generic fallback certificates out of scope; `certificate-layouts.ts` must never be hand-edited.

## Global Constraints

- Never hand-edit `src/lib/services/certificate-layouts.ts` (auto-generated; verified glyph-by-glyph by `python scripts/cert_layout.py verify` against `public/pdf/`).
- Placeholder set is exactly `name, grade, schoolYear, lrn, purpose, day, month`. Unknown/malformed placeholders are rejected with 400 on save.
- `"School Counselor Associate 1"` (with digit 1) is the `registrarTitle` default on both good-moral templates; `registrarTitle` is null on enrolment/graduation (field hidden in UI).
- Body regions, per template (line indices of `CERT_LAYOUTS[key].lines`, title = index 6):

| template | body lines | paragraphs | signatory title lines | body font | blank slot widths (pt) |
|---|---|---|---|---|---|
| good-moral | 7–14 | 3 (7-9, 10-12, 13-14) | registrarName:16, principalName:18 | bookman@11 | name 99, grade 49.4, schoolYear 60.51, day 38.5, month 71.5 |
| good-moral-jhs | 7–14 | 3 (7-9, 10-12, 13-14) | registrarName:16, principalName:18 | bookman@11 | same as good-moral |
| enrolment-jhs | 7–10 | 2 (7-9, 10) | principalName:12 | bookman@12 | name 108, lrn 102, schoolYear 60, grade 60.08, purpose 90.08 |
| enrolment-shs | 7–11 | 2 (7-10, 11) | principalName:13 | bookman@12 | name 108, lrn 102, schoolYear 60, grade 60, purpose 90.08 |
| graduation | 7–11 | 2 (7-10, 11) | principalName:13 | bookman@12 | name 185.9, schoolYear 96 |

- Constants: `SIGNATURE_CLEARANCE = 24` pt (body may not render below `firstSigNameY − 24`), `MIN_BODY_SIZE = 9`, shrink step 0.5pt, preview debounce 800ms, worst-case validation blanks: name `"Maria Clara Santos Dela Cruz Bautista"`, grade `"12 - Home Economics"`, schoolYear `"2025-2026"`, lrn `"123456789012"`, purpose `"scholarship application and board examination"`, day `"31"`, month `"September 2026"`.
- New test files must be appended to the `test:unit` file list in `package.json`.
- Run single tests: `node --import tsx --test --test-concurrency=1 <testfile>`; full suite: `npm run test:unit`.
- DB: `npm run db:generate` then `npm run db:migrate` after schema changes.

## File Structure

- Create `src/lib/services/certificate-wording-regions.ts` — derive body/title/signatory regions + slot widths from a layout (Task 1)
- Create `src/lib/services/certificate-wording-defaults.ts` — `TemplateWording`, `DEFAULT_WORDING`, `SAMPLE_BLANKS`, `WORST_CASE_BLANKS`, `PLACEHOLDER_FIELDS` (Task 2)
- Create `src/lib/services/certificate-body-layout.ts` — `planBodyLayout` / `assertBodyFits` / `TooLongBodyError` (Task 3)
- Modify `src/lib/services/certificate-renderer.ts` — `wording` option + `renderSampleCertificate` (Task 4); Modify `src/lib/services/certificates.ts:627-670` — resolve + pass wording (Task 4); Modify `scripts/render-cert-samples.ts` (Task 4)
- Create `src/lib/services/document-template-wording.ts` + `src/db/schema.ts` + migration (Task 5)
- Create `src/app/api/document-template/wording/route.ts`, `src/app/api/document-template/preview/route.ts` (Task 6)
- Create `src/components/document-template-editor.tsx`; Modify `src/app/(portal)/admin/document-template/page.tsx`; Delete `src/components/document-signatory-template-form.tsx` (Task 7)

---

### Task 1: Wording region derivation

**Files:**
- Create: `src/lib/services/certificate-wording-regions.ts`
- Test: `src/lib/services/certificate-wording-regions.test.ts`

**Interfaces:**
- Consumes: `CertTemplateLayout`, `CertToken`, `CertBlankField` from `@/lib/services/certificate-layouts`.
- Produces:
  ```ts
  export interface WordingRegions {
    titleLine: number;
    bodyLines: { first: number; last: number }; // inclusive
    signatoryTitles: Array<{ field: "registrarName" | "principalName"; line: number }>;
  }
  export function deriveWordingRegions(layout: CertTemplateLayout): WordingRegions;
  export function bodySlotWidths(layout: CertTemplateLayout, regions: WordingRegions): Partial<Record<CertBlankField, number>>;
  ```
  `bodySlotWidths` = max `x1 - x` per blank field inside `bodyLines` (fallback 60 when a used field has no slot).

- [ ] **Step 1: Write the failing test** (`certificate-wording-regions.test.ts`, node:test style like `certificate-renderer.test.ts`)

```ts
it("derives the regions for each template", () => {
  assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["good-moral"]),
    { titleLine: 6, bodyLines: { first: 7, last: 14 },
      signatoryTitles: [{ field: "registrarName", line: 16 }, { field: "principalName", line: 18 }] });
  assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["enrolment-jhs"]),
    { titleLine: 6, bodyLines: { first: 7, last: 10 },
      signatoryTitles: [{ field: "principalName", line: 12 }] });
  // enrolment-shs: body 7..11, principalName 13; graduation: body 7..11, principalName 13; good-moral-jhs same as good-moral
});

it("falls back safely when the layout drifts from the expected structure", () => {
  // deep-clone CERT_LAYOUTS["good-moral"], remove the sigName token from line 15,
  // assert deriveWordingRegions returns signatoryTitles: [] and bodyLines.last === 14 (body stops at the old sig line)
});

it("reports per-field slot widths from the body region", () => {
  assert.deepEqual(bodySlotWidths(CERT_LAYOUTS["good-moral"], regions), { name: 99, grade: 49.4, schoolYear: 60.51, day: 38.5, month: 71.5 });
});
```

- [ ] **Step 2: Run test to verify it fails** — `node --import tsx --test --test-concurrency=1 src/lib/services/certificate-wording-regions.test.ts` → FAIL "cannot find module …-regions".
- [ ] **Step 3: Implement the three functions.** Derivation rule: `titleLine = layout.titleLineIndex`; `bodyLines = { first: titleLine + 1, last: (first line index containing a `sigName` token) − 1 }`; `signatoryTitles` = for each line `i` with exactly one `sigName` token of y `sy`: the first line `j = i+1` whose tokens are all `kind:"text"` and `sy − lineY` ∈ [12, 25] → `{ field, line: j }`. Drift rule: if no line contains a `sigName`, `bodyLines.last` stays at the last line index and `signatoryTitles` is `[]`.
- [ ] **Step 4: Run test to verify it passes.**
- [ ] **Step 5: Add `src/lib/services/certificate-wording-regions.test.ts` to the `test:unit` list in `package.json`; commit** — `git commit -m "feat(certificates): derive wording regions from generated layouts"`.

### Task 2: Default wording and sample values

**Files:**
- Create: `src/lib/services/certificate-wording-defaults.ts`
- Test: `src/lib/services/certificate-wording-defaults.test.ts`

**Interfaces:**
- Consumes: `CertTemplateKey`, `CertBlankValues` (from `certificate-renderer`), `deriveWordingRegions`/`bodySlotWidths` (Task 1).
- Produces:
  ```ts
  export interface TemplateWording {
    title: string; body: string;
    principalTitle: string | null; registrarTitle: string | null;
  }
  export const PLACEHOLDER_FIELDS: readonly ["name","grade","schoolYear","lrn","purpose","day","month"];
  export const DEFAULT_WORDING: Record<CertTemplateKey, TemplateWording>;
  export const SAMPLE_BLANKS: Record<CertTemplateKey, CertBlankValues>;
  export const WORST_CASE_BLANKS: Record<(typeof PLACEHOLDER_FIELDS)[number], string>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
it("matches the generated layout letter-for-letter (drift guard)", () => {
  // for each template key: join body-region token letters (text t; blank -> {{field}}), strip spaces;
  // assert equal to DEFAULT_WORDING[key].body stripped of spaces, "*" and newlines.
  // also assert the title letters equal DEFAULT_WORDING[key].title stripped of spaces,
  // and signatory-title line letters equal "SchoolCounselorAssociate1" / "PrincipalIV".
});
it("keeps the digit in School Counselor Associate 1", () => {
  assert.equal(DEFAULT_WORDING["good-moral"].registrarTitle, "School Counselor Associate 1");
  assert.equal(DEFAULT_WORDING["enrolment-jhs"].registrarTitle, null);
});
it("uses placeholder-only bodies with the fixed field set", () => { /* every {{...}} in every body ∈ PLACEHOLDER_FIELDS */ });
```

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement the module.** `DEFAULT_WORDING` exact values (paragraphs separated by blank lines):

| key | title | body |
|---|---|---|
| good-moral | `CERTIFICATE OF GOOD MORAL CHARACTER` | P1 `This is to certify that {{name}} is a bonafide student of Luis Aguado National High School classified under the Grade {{grade}} strand for the school year {{schoolYear}}.` P2 `This certifies further that the aforementioned student is of good moral character and has never been subjected to any disciplinary action in this institution. This certification is issued for whatever legal purpose it may serve him/her.` P3 `Given this {{day}} day of {{month}} at Luis Aguado National High School, Trece Martires City, Cavite.` |
| good-moral-jhs | same title | P1 `…classified as Grade {{grade}} for the school year {{schoolYear}}.` (rest identical to good-moral) |
| enrolment-jhs | `CERTIFICATE OF ENROLMENT` | P1 `This is to certify that {{name}}, bearing Learner Reference Number {{lrn}}, is a student of LUIS AGUADO NATIONAL HIGH SCHOOL for school year {{schoolYear}}, classified as Grade {{grade}}.` P2 `This certificate is issued for {{purpose}} purposes.` |
| enrolment-shs | `CERTIFICATE OF ENROLMENT` | P1 `…classified under the Grade {{grade}} strand.` (else as enrolment-jhs) P2 same |
| graduation | `CERTIFICATE OF GRADUATION` | P1 `This is to certify that {{name}} is a **GRADUATE** of LUIS AGUADO NATIONAL HIGH SCHOOL for school year {{schoolYear}} and successfully completed the academic requirements for Basic Academic Secondary Education Course.` P2 `Issued upon request.` |

  `principalTitle: "Principal IV"` on all five; `registrarTitle: "School Counselor Associate 1"` on good-moral/-jhs, `null` otherwise. `SAMPLE_BLANKS` = the `FILLED` values currently in `scripts/render-cert-samples.ts:27-60`. `WORST_CASE_BLANKS` = the values in Global Constraints.
- [ ] **Step 4: Run test to verify it passes** (the drift guard is what proves the transcription exact).
- [ ] **Step 5: Register test in `test:unit`; commit** — `feat(certificates): add default wording and sample values`.

### Task 3: Body typesetting planner

**Files:**
- Create: `src/lib/services/certificate-body-layout.ts`
- Test: `src/lib/services/certificate-body-layout.test.ts`

**Interfaces:**
- Consumes: `EmbeddedCertFonts`, `CertFontKey`, `CertBlankField`, `CertBlankValues`, Task 2's `PLACEHOLDER_FIELDS`/`WORST_CASE_BLANKS`, layout geometry values.
- Produces:
  ```ts
  export interface BodyOp { text: string; x: number; y: number; size: number; font: CertFontKey; underline?: { x: number; width: number } }
  export class TooLongBodyError extends Error {}
  export function planBodyLayout(input: {
    body: string; fonts: EmbeddedCertFonts;
    bodyFont: CertFontKey; boldFont: CertFontKey; bodySize: number;
    firstBodyY: number; bodyLeading: number; bodyMargin: number; bodyIndent: number;
    rightEdge: number; blockBottom: number;
    values: CertBlankValues;
    slotWidth: (field: CertBlankField) => number;
    minSize?: number; // default 9
  }): { ops: BodyOp[]; size: number };
  export function assertBodyFits(templateKey: CertTemplateKey, body: string): void; // throws TooLongBodyError
  ```

- [ ] **Step 1: Write the failing test**

```ts
it("substitutes values bold with a measured underline", () => { /* op for "{{name}}" value: font=boldFont, underline.width ≈ font.widthOfTextAtSize(value,size) */ });
it("renders empty values as an underscore run of slot width", () => { /* op text all "_", width ≈ slotWidth ± 1 glyph */ });
it("renders **GRADUATE** bold", () => { /* the op containing GRADUATE has font=boldFont */ });
it("always keeps a full space between words and around values", () => {
  // plan DEFAULT_WORDING["good-moral"].body with sample values;
  // assert every gap between consecutive ops on a line >= 0.9 * fonts.bookman.widthOfTextAtSize(" ", size)
  // (this is the regression test for "year2025-2026")
});
it("shrinks to fit and errors beyond the minimum", () => {
  // body of 30 short words in a 5-line block -> size < bodySize and last op y >= blockBottom;
  // body of 500 words -> assert.throws(() => plan(...), TooLongBodyError)
});
```

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement `planBodyLayout`.** Algorithm (the part the tests don't determine): split `body` on blank lines into paragraphs; within each paragraph split on `/\s+/` into words; tokenize each word into runs by `{{\s*([A-Za-z]+)\s*\}\}` matches (unknown fields → keep literal); apply bold by splitting each text run on `**` (odd segments bold; if segment count is even, treat literally). Word width = sum of run widths (values measured at their text; empty values = `slotWidth` of underscores). Greedy wrap: first line width `rightEdge − bodyMargin − bodyIndent`, later lines `rightEdge − bodyMargin`; justify all lines except each paragraph's last (extra = free space / (words − 1), floor 0). Baselines: `firstBodyY − k·bodyLeading`. Value ops carry `underline: { x: opX, width: valueWidth }` (empty values get no underline — the underscore run is the line). Size search: try `bodySize, bodySize − 0.5, … , minSize`; first size whose last baseline `≥ blockBottom` wins; none fits → `TooLongBodyError`. `assertBodyFits` creates a throwaway `PDFDocument`, embeds fonts via `embedCertificateFonts`, and plans with `WORST_CASE_BLANKS`.
- [ ] **Step 4: Run test to verify it passes.**
- [ ] **Step 5: Register test in `test:unit`; commit** — `feat(certificates): typeset body wording with correct spacing`.

### Task 4: Renderer wording integration

**Files:**
- Modify: `src/lib/services/certificate-renderer.ts`
- Modify: `src/lib/services/certificates.ts:627-670` (`generateCertificatePdf`)
- Modify: `scripts/render-cert-samples.ts`
- Test: `src/lib/services/certificate-renderer.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 1–3 outputs, `DEFAULT_WORDING`.
- Produces: `CertificateRenderOptions` gains `wording?: TemplateWording` (used only when `template !== null`); new export
  ```ts
  export function renderSampleCertificate(
    template: CertTemplateKey, wording: TemplateWording,
    names: { registrarName?: string; principalName?: string },
  ): Promise<Uint8Array>; // renders with SAMPLE_BLANKS[template], no QR
  ```

- [ ] **Step 1: Write the failing test**

```ts
it("renders every template with default wording as a valid PDF", () => { /* bytes[0..4] === "%PDF" for all 5 keys via renderSampleCertificate */ });
it("reflects edited wording", () => { /* renderSampleCertificate with body "...school year {{schoolYear}} **EXTRA**." differs from default render */ });
it("keeps the existing verbatim path", async () => {
  // renderCertificatePdf({ template: "good-moral", blanks: {}, signatureNames: {...} }) (no wording)
  // still passes the existing tests unchanged
});
```

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement.** In `renderCertificatePdf`, when `options.template && options.wording`: derive regions (Task 1); drift-check by comparing the body-region letters against `DEFAULT_WORDING[template].body` (spaces/`*`/newlines stripped) — on mismatch, fall through to today's verbatim path. Otherwise draw decor as today; skip drawing lines in `bodyLines` (replaced by `planBodyLayout` ops using the layout's `firstBodyY/bodyLeading/bodyMargin/bodyIndent`, `rightEdge = 524.9`, `blockBottom = (min sigName y) − 24`, dominant body font/size from the region's text tokens and its bold variant via `bookman→bookmanBold`); skip + redraw the title line when `wording.title !== DEFAULT_WORDING[k].title` (centered at `297.64`, title baseline, dominant title font/size; `""` draws nothing); skip + redraw a signatory-title line when its wording differs (centered on the original line's own visual center, its baseline; `""` draws nothing). `generateCertificatePdf`: `const wordingMap = await getDocumentTemplateWording();` then pass `wording: template ? wordingMap[template] : undefined` (compute `template` once via `pickCertificateTemplate`). `scripts/render-cert-samples.ts`: verification samples keep `wording` absent (verbatim — `cert_layout.py verify` must stay green); filled samples pass `DEFAULT_WORDING[key]` and import `SAMPLE_BLANKS` instead of local `FILLED`.
- [ ] **Step 4: Run test to verify it passes** — plus `npm run test:unit` (whole suite green) and `python scripts/cert_layout.py verify` unchanged if available.
- [ ] **Step 5: Register any new test file; commit** — `feat(certificates): render editable wording with verbatim fallback`.

### Task 5: Wording storage service

**Files:**
- Modify: `src/db/schema.ts` (after `documentSignatoryTemplate`, ~line 134)
- Create: `src/lib/services/document-template-wording.ts`
- Generated migration via `npm run db:generate`
- Test: `src/lib/services/document-template-wording.test.ts` (integration/local-DB pattern of `certificate-edit-view.test.ts`)

**Interfaces:**
- Consumes: `TemplateWording`, `DEFAULT_WORDING`, `PLACEHOLDER_FIELDS`, `assertBodyFits`/`TooLongBodyError` (Tasks 2–3).
- Produces:
  ```ts
  export async function getDocumentTemplateWording(): Promise<Record<CertTemplateKey, TemplateWording>>;
  export async function saveDocumentTemplateWording(input: unknown): Promise<TemplateWording>; // { template, title, body, principalTitle, registrarTitle }
  export async function resetDocumentTemplateWording(template: string): Promise<TemplateWording>;
  ```
  Table `document_template_wording`: `template_key varchar(40) pk`, `title text`, `body text`, `principal_title text`, `registrar_title text` (nullable = default), `updated_at timestamptz notNull defaultNow`.

- [ ] **Step 1: Write the failing test**

```ts
it("saves only fields that differ from the default", () => { /* save({template:"good-moral", title:"X", body:DEFAULT body, ...}) -> row columns title="X", body=null; get returns title "X", body default */ });
it("round-trips a blank registrar title", () => { /* save registrarTitle "" -> get registrarTitle "" (not the default) */ });
it("rejects unknown and malformed placeholders", () => { /* body "Hi {{name}} {{strand}}" and "Hi {{name" -> throws ZodError with message containing "placeholder" */ });
it("rejects bodies that overflow worst-case values", () => { /* body of 500 words -> throws TooLongBodyError */ });
it("resets to defaults", () => { /* save overrides -> reset -> get returns DEFAULT_WORDING entry */ });
```

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement.** Zod schema in the service (pattern of `documentSignatoryTemplateSchema`): `template` enum of the 5 keys; `title` ≤ 200; `body` 1–4000 after trim; titles ≤ 120. Placeholder validation: every `{{...}}` match of `/\{\{\s*[A-Za-z]+\s*\}\}/g` must be a known field, and any `{{` or `}}` outside a full match → issue message `"Check the placeholders — use {{name}}, {{grade}}, {{schoolYear}}, {{lrn}}, {{purpose}}, {{day}} or {{month}}."`. Save stores `trimmed === default ? null : trimmed` per column, `onConflictDoUpdate` on `template_key`, then calls `assertBodyFits(template, body)` **before** writing (map `TooLongBodyError` → `"Body text is too long for this document."`). Get merges defaults over the row (null → default; `""` preserved). Migrate: `npm run db:generate && npm run db:migrate`.
- [ ] **Step 4: Run test to verify it passes** + `npm run test:unit`.
- [ ] **Step 5: Register test; commit** — `feat(document-template): store per-template wording overrides`.

### Task 6: Admin API routes

**Files:**
- Create: `src/app/api/document-template/wording/route.ts` (GET/PUT/DELETE)
- Create: `src/app/api/document-template/preview/route.ts` (POST)
- Test: `src/app/api/document-template/wording/route.test.ts`, `src/app/api/document-template/preview/route.test.ts` (pattern of `src/app/api/auth/signup/route.test.ts`)

**Interfaces:**
- Consumes: Task 5 service, `renderSampleCertificate` (Task 4), `DEFAULT_WORDING`.
- Produces: JSON `{ data: ... }` (shape of `/api/document-signatory-template`); preview returns `application/pdf` bytes (response shape of `src/app/api/certificates/[id]/pdf/route.ts`).
  - `GET /api/document-template/wording` → `{ data: Record<CertTemplateKey, TemplateWording> }`
  - `PUT` body `{ template, title, body, principalTitle, registrarTitle }` → `{ data: TemplateWording }`
  - `DELETE ?template=<key>` → `{ data: TemplateWording }`
  - `POST /api/document-template/preview` body `{ template, title, body, principalTitle, registrarTitle, principalName, registrarName }` → PDF

- [ ] **Step 1: Write the failing tests** — wording route: unauthenticated GET → 401, non-admin → 403 (same `requireAdmin` helper copied from `document-signatory-template/route.ts`); PUT with unknown placeholder → 400 `{ error }` containing "placeholder"; DELETE returns defaults. Preview route: POST per each of the 5 templates → 200, `content-type: application/pdf`, body starts `"%PDF"`; names ≤ 200 enforced (400 beyond).
- [ ] **Step 2: Run tests to verify they fail.**
- [ ] **Step 3: Implement** thin handlers delegating to the service and `renderSampleCertificate(template, wording, names)`; Zod errors → 400 with `error.issues[0].message` (existing pattern), `TooLongBodyError` → 400 `"Body text is too long for this document."`.
- [ ] **Step 4: Run tests to verify they pass** + `npm run test:unit`.
- [ ] **Step 5: Register both tests; commit** — `feat(document-template): admin wording and preview APIs`.

### Task 7: Admin template editor UI

**Files:**
- Create: `src/components/document-template-editor.tsx`
- Modify: `src/app/(portal)/admin/document-template/page.tsx`
- Delete: `src/components/document-signatory-template-form.tsx`

**Interfaces:**
- Consumes: `TemplateWording`, `DEFAULT_WORDING`, `PLACEHOLDER_FIELDS`, Task 6 endpoints.
- Produces: `<DocumentTemplateEditor names={{ registrarName, principalName }} wording={Record<CertTemplateKey, TemplateWording>} />` (client component).

- [ ] **Step 1: Implement the component and page** (UI — verified manually in Step 2):
  - Layout: two columns (`lg:grid-cols-[420px_1fr]` like `certificate-preview-editor.tsx`). Left: "Signatories" card (principal/registrar name inputs + Save → `PUT /api/document-signatory-template`) and a document tab bar — labels `Good Moral (SHS)`, `Good Moral (JHS)`, `Enrolment (JHS)`, `Enrolment (SHS)`, `Graduation` mapping to `good-moral`, `good-moral-jhs`, `enrolment-jhs`, `enrolment-shs`, `graduation` — with fields Document title, Body (textarea), Principal title, Registrar title (shown only when `DEFAULT_WORDING[key].registrarTitle !== null`). An "edited" badge (style of `certificate-preview-editor.tsx`'s) marks fields differing from defaults. Placeholder chips (the 7 fields) insert `{{field}}` at the textarea cursor; hint line: `Wrap **text** to make it bold.` Buttons: `Save` (PUT, toast `"Document template saved."`), `Reset to original wording` (DELETE, then set the tab's fields to the returned defaults, toast `"Original wording restored."`).
  - Right: "PDF preview" card — iframe fed by `POST /api/document-template/preview` (fetch → `URL.createObjectURL` → iframe, revoke previous URL), debounced 800ms on any draft change, spinner + `"Preview unavailable in this browser."` fallback (patterns from `certificate-preview-editor.tsx:47-58, 246-278`), caption `"Preview uses sample student data."`.
  - Page: server component fetching `getDocumentTemplateWording()` + `getDocumentSignatoryTemplate()`, heading copy: `Edit the wording printed on each certificate, with a live preview.`
- [ ] **Step 2: Manual verification** (`npm run dev`, admin sign-in): each tab shows its wording and updates the preview while typing (debounce); Save persists across reload; Reset restores defaults (good-moral shows `School Counselor Associate 1`); registrar title absent on enrolment/graduation; the "How it works" bullets explain defaults vs registrar overrides; registrar's `/registrar/certificates/[id]/edit` unchanged; generate a Good Moral certificate and confirm `year 2025-2026` has a space and Enrolment shows `____, is a student`.
- [ ] **Step 3: Commit** — `feat(admin): document template editor with live PDF preview`.

---

## Review Focus

1. **Real certificates with long fill-in values** (long student name/purpose) must never collide with the signature block — render shrinks toward 9pt, save blocks beyond worst case → Task 3 "shrinks to fit…" test + Task 5 "rejects bodies that overflow" test.
2. **Malformed placeholders** (`{{strand}}`, `{{name`) must 400 and persist nothing → Task 5 rejection tests + Task 6 route test.
3. **Layout regeneration drift** (`scripts/cert_layout.py generate`) must degrade to verbatim rendering, never garble output → Task 1 "falls back safely" test.
4. **Empty field values** (registrar blanks a field on a real certificate) print underscores of the right width, no zero-width or crash → Task 3 "renders empty values…" test.
5. **Save-without-changes purity** — a saved template identical to defaults stores no override and prints identically to a fresh install, while untouched titles/signatory titles stay character-identical → Task 5 "saves only fields that differ" test + Task 4 "keeps the existing verbatim path" test.
