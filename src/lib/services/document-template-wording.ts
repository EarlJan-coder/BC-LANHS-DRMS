import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documentTemplateWording } from "@/db/schema";
import { assertBodyFits } from "@/lib/services/certificate-body-layout";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import { DEFAULT_WORDING, PLACEHOLDER_FIELDS, type TemplateWording } from "@/lib/services/certificate-wording-defaults";
import { z } from "zod";

const TEMPLATE_KEYS = Object.keys(DEFAULT_WORDING) as [CertTemplateKey, ...CertTemplateKey[]];
const templateKeySchema = z.enum(TEMPLATE_KEYS);

const PLACEHOLDER_MESSAGE =
  "Check the placeholders — use {{name}}, {{grade}}, {{schoolYear}}, {{lrn}}, {{purpose}}, {{day}} or {{month}}.";

/**
 * Every `{{` occurrence must be the start of a full placeholder match with a
 * known field, and every `}}` occurrence must be the end of such a match.
 * Anything else — unknown fields, malformed placeholders, or braces that
 * straddle a match boundary — is invalid.
 */
function hasValidPlaceholders(body: string): boolean {
  const known: readonly string[] = PLACEHOLDER_FIELDS;
  const starts = new Set<number>();
  const ends = new Set<number>();
  const pattern = /\{\{\s*([A-Za-z]+)\s*\}\}/g;
  for (let match = pattern.exec(body); match !== null; match = pattern.exec(body)) {
    if (!known.includes(match[1])) return false;
    starts.add(match.index);
    ends.add(match.index + match[0].length);
  }
  for (let i = body.indexOf("{{"); i !== -1; i = body.indexOf("{{", i + 1)) {
    if (!starts.has(i)) return false;
  }
  for (let i = body.indexOf("}}"); i !== -1; i = body.indexOf("}}", i + 1)) {
    if (!ends.has(i + 2)) return false;
  }
  return true;
}

const documentTemplateWordingSchema = z.object({
  template: templateKeySchema,
  title: z.string().trim().max(200, "Title must be 200 characters or fewer."),
  body: z
    .string()
    .trim()
    .min(1, "Body text is required.")
    .max(4000, "Body text must be 4000 characters or fewer.")
    .refine(hasValidPlaceholders, PLACEHOLDER_MESSAGE),
  principalTitle: z.string().trim().max(120, "Principal title must be 120 characters or fewer."),
  registrarTitle: z.string().trim().max(120, "Registrar title must be 120 characters or fewer."),
});

type WordingRow = typeof documentTemplateWording.$inferSelect;

function mergeWithDefaults(template: CertTemplateKey, row: WordingRow | undefined): TemplateWording {
  const defaults = DEFAULT_WORDING[template];
  return {
    title: row?.title ?? defaults.title,
    body: row?.body ?? defaults.body,
    principalTitle: row?.principalTitle ?? defaults.principalTitle,
    registrarTitle: row?.registrarTitle ?? defaults.registrarTitle,
  };
}

export async function getDocumentTemplateWording(): Promise<Record<CertTemplateKey, TemplateWording>> {
  const rows = await getDb().select().from(documentTemplateWording);
  const byKey = new Map(rows.map((row) => [row.templateKey, row]));
  return Object.fromEntries(TEMPLATE_KEYS.map((key) => [key, mergeWithDefaults(key, byKey.get(key))])) as Record<
    CertTemplateKey,
    TemplateWording
  >;
}

export async function saveDocumentTemplateWording(input: unknown): Promise<TemplateWording> {
  const { template, ...values } = documentTemplateWordingSchema.parse(input);
  await assertBodyFits(template, values.body);

  const defaults = DEFAULT_WORDING[template];
  const columns = {
    title: values.title === defaults.title ? null : values.title,
    body: values.body === defaults.body ? null : values.body,
    principalTitle: values.principalTitle === defaults.principalTitle ? null : values.principalTitle,
    registrarTitle: values.registrarTitle === defaults.registrarTitle ? null : values.registrarTitle,
  };
  const [row] = await getDb()
    .insert(documentTemplateWording)
    .values({ templateKey: template, ...columns, updatedAt: new Date() })
    .onConflictDoUpdate({ target: documentTemplateWording.templateKey, set: { ...columns, updatedAt: new Date() } })
    .returning();
  return mergeWithDefaults(template, row);
}

export async function resetDocumentTemplateWording(template: string): Promise<TemplateWording> {
  const key = templateKeySchema.parse(template);
  await getDb().delete(documentTemplateWording).where(eq(documentTemplateWording.templateKey, key));
  return mergeWithDefaults(key, undefined);
}
