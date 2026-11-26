import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Source-level audit for required-field markers.
 *
 * The rule this encodes: a label shows an asterisk if and only if the control
 * it labels carries the `required` attribute, because `required` is exactly
 * what stops the browser letting the user submit an empty value.
 *
 * This is a static scan rather than a render test because the repo has no DOM
 * test harness (tests are `node:test` over `src/lib`). Scanning the source
 * keeps the check honest: it reads the same `required` attributes the browser
 * reads, so a field added without a marker fails here.
 */

type Tag = {
  name: string;
  attrs: string;
  /** Text between the open and close tag, or null when self-closing. */
  inner: string | null;
};

const COMPONENTS_DIR = fileURLToPath(new URL("../components", import.meta.url));

/** Matches the two marker spellings allowed in a label. */
const MARKER = /<Required \/>|<span className="text-red-900">\*<\/span>/;

function skipString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return index;
}

/**
 * Index of the `>` that closes a tag's opening sequence, or -1.
 *
 * Brace depth keeps `>` inside a JSX expression — notably the `=>` of an
 * inline `onChange` handler — from terminating the tag early.
 */
function findTagOpenEnd(source: string, start: number): number {
  let index = start + 1;
  let depth = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'") {
      index = skipString(source, index);
      continue;
    }
    if (char === "{") {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === "}") {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }
    if (char === ">" && depth === 0) return index;
    index += 1;
  }
  return -1;
}

/** Every JSX element in a file, including those nested inside other elements. */
function scanTags(source: string): Tag[] {
  const tags: Tag[] = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] !== "<") {
      index += 1;
      continue;
    }
    const next = source[index + 1];
    if (!next || !/[A-Za-z/!]/.test(next)) {
      index += 1;
      continue;
    }
    const openEnd = findTagOpenEnd(source, index);
    if (openEnd === -1) break;
    const raw = source.slice(index + 1, openEnd);
    if (raw.startsWith("/") || raw.startsWith("!")) {
      index = openEnd + 1;
      continue;
    }
    const nameMatch = /^([A-Za-z][A-Za-z0-9.]*)/.exec(raw);
    if (!nameMatch) {
      index = openEnd + 1;
      continue;
    }
    const name = nameMatch[1];
    const attrs = raw.slice(name.length);
    const selfClosing = raw.trimEnd().endsWith("/");
    if (selfClosing) {
      tags.push({ name, attrs, inner: null });
      index = openEnd + 1;
      continue;
    }
    const closeStart = source.indexOf(`</${name}>`, openEnd + 1);
    if (closeStart === -1) {
      // No matching close tag — a generic like `useState<FormState>` reads as an
      // element here. Consume just the open tag and keep scanning rather than
      // abandoning the rest of the file.
      tags.push({ name, attrs, inner: null });
      index = openEnd + 1;
      continue;
    }
    tags.push({ name, attrs, inner: source.slice(openEnd + 1, closeStart) });
    // Step into the element so nested tags are scanned too; the close tag is
    // skipped by the branch above when we reach it.
    index = openEnd + 1;
  }
  return tags;
}

function attrValue(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|\\{([^}]*)\\})`).exec(attrs);
  if (!match) return null;
  return match[2] !== undefined ? match[2] : match[3];
}

function hasAttr(attrs: string, name: string): boolean {
  // Require a boundary before the name so `aria-required` is not a match.
  return new RegExp(`(?:^|\\s)${name}(?:\\s|=|$)`).test(attrs);
}

function isLabel(tag: Tag): boolean {
  return (tag.name === "Label" || tag.name === "label") && tag.inner !== null;
}

/** Plain text of a label's children, for readable failure messages. */
function labelText(inner: string): string {
  return inner
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function componentFiles(): { file: string; source: string }[] {
  const found: { file: string; source: string }[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
        found.push({ file: path.relative(path.join(COMPONENTS_DIR, "..", ".."), full), source: readFileSync(full, "utf8") });
      }
    }
  }
  walk(COMPONENTS_DIR);
  return found;
}

describe("required field markers", () => {
  it("marks every control the browser blocks from being left empty", () => {
    const missing: string[] = [];

    for (const { file, source } of componentFiles()) {
      const tags = scanTags(source);
      const labels = tags.filter(isLabel);
      const fields = tags.filter((tag) => hasAttr(tag.attrs, "required"));

      for (const field of fields) {
        // `required={required}` inside a field component's own definition mirrors
        // the prop; the call sites and the gate itself are covered below.
        if (/\brequired\s*=\s*\{\s*required\s*\}/.test(field.attrs)) continue;
        const id = attrValue(field.attrs, "id");
        // A label rendered by a custom component (e.g. <Field>) has no htmlFor
        // at the call site; that is covered by the component-gating test below.
        const customComponent = /^[A-Z]/.test(field.name);
        const label = id ? labels.find((entry) => attrValue(entry.attrs ?? "", "htmlFor") === id) : undefined;
        if (!label) {
          if (!customComponent) missing.push(`${file}: <${field.name} id=${id ?? "?"}> has no matching label`);
          continue;
        }
        if (!MARKER.test(label.inner ?? "")) {
          missing.push(`${file}: "${labelText(label.inner ?? "")}" is required but has no asterisk`);
        }
      }

      // A label that wraps its control directly (no htmlFor / id pairing).
      for (const label of labels) {
        const inner = label.inner ?? "";
        if (attrValue(label.attrs, "htmlFor")) continue;
        const wrapped = scanTags(inner).find((tag) => hasAttr(tag.attrs, "required"));
        if (wrapped && !MARKER.test(inner)) {
          missing.push(`${file}: "${labelText(inner)}" wraps a required control but has no asterisk`);
        }
      }
    }

    assert.deepEqual(missing, [], `Labels missing a required-field asterisk:\n${missing.join("\n")}`);
  });

  it("keeps the marker's conditionality in step with the required attribute", () => {
    const mismatched: string[] = [];

    for (const { file, source } of componentFiles()) {
      const tags = scanTags(source);
      const labels = tags.filter(isLabel);

      for (const field of tags) {
        if (!hasAttr(field.attrs, "required")) continue;
        if (/\brequired\s*=\s*\{\s*required\s*\}/.test(field.attrs)) continue;
        const id = attrValue(field.attrs, "id");
        const label = id ? labels.find((entry) => attrValue(entry.attrs ?? "", "htmlFor") === id) : undefined;
        if (!label) continue;
        const inner = label.inner ?? "";
        if (!MARKER.test(inner)) continue; // already reported by the test above

        const expression = /\brequired\s*=\s*\{([^}]*)\}/.exec(field.attrs)?.[1]?.trim();
        const conditionalMarker = /\{\s*[A-Za-z_$][\w$]*\s*\?\s*<Required\s*\/>/.test(inner);

        if (expression) {
          // Required only sometimes: the marker has to appear on the same terms.
          const guarded = new RegExp(`\\{\\s*${expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\?`).test(inner);
          if (!guarded) {
            mismatched.push(`${file}: "${labelText(inner)}" is required={${expression}} but the asterisk is unconditional`);
          }
        } else if (conditionalMarker) {
          // Required always: the marker must not vanish behind a condition.
          mismatched.push(`${file}: "${labelText(inner)}" is always required but the asterisk is conditional`);
        }
      }
    }

    assert.deepEqual(mismatched, [], `Markers out of step with \`required\`:\n${mismatched.join("\n")}`);
  });

  it("gates the asterisk on the required prop inside label-rendering components", () => {
    const offenders: string[] = [];

    for (const { file, source } of componentFiles()) {
      const tags = scanTags(source);
      const labels = tags.filter(isLabel);
      // A call site passing `label=` has no label element of its own — the
      // component renders it, so the gate has to live in that component.
      const selfLabelled = tags.filter(
        (tag) =>
          hasAttr(tag.attrs, "required") &&
          /(?:^|\s)label\s*=/.test(tag.attrs) &&
          !labels.some((label) => attrValue(label.attrs, "htmlFor") === attrValue(tag.attrs, "id")),
      );
      if (selfLabelled.length === 0) continue;
      if (!/\{\s*required\s*\?\s*<Required\s*\/>\s*:\s*null\s*\}/.test(source)) {
        offenders.push(
          `${file}: ${selfLabelled.map((tag) => `<${tag.name}>`).join(", ")} take \`required\` but do not gate the label's asterisk on it`,
        );
      }
    }

    assert.deepEqual(offenders, [], `Field components not gating their marker on \`required\`:\n${offenders.join("\n")}`);
  });
});
