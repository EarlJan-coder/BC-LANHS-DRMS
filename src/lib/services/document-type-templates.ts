import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { documentTypeTemplates, documentTypes } from "@/db/schema";
import { assertBodyFits } from "@/lib/services/certificate-body-layout";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import { DEFAULT_WORDING, PLACEHOLDER_FIELDS, type TemplateWording } from "@/lib/services/certificate-wording-defaults";
import { AppError } from "@/lib/utils";

const LAYOUT_KEYS = Object.keys(DEFAULT_WORDING) as [CertTemplateKey, ...CertTemplateKey[]];
const placeholderPattern = /\{\{\s*([A-Za-z]+)\s*\}\}/g;
const placeholderMessage =
  "Use supported placeholders: {{name}}, {{grade}}, {{schoolYear}}, {{lrn}}, {{purpose}}, {{day}} or {{month}}.";

export function defaultDocumentTypeTemplate(name: string) {
  return {
    layoutKey: "enrolment-jhs" as const,
    title: name.toUpperCase(),
    body: "This is to certify that {{name}} has a validated document request recorded at Luis Aguado National High School. This certificate is issued upon request for {{purpose}}.\n\nGiven this {{day}} day of {{month}}.",
    principalTitle: "Principal IV",
    registrarTitle: "",
  };
}

function validPlaceholders(body: string) {
  const starts = new Set<number>();
  const ends = new Set<number>();
  for (let match = placeholderPattern.exec(body); match; match = placeholderPattern.exec(body)) {
    if (!(PLACEHOLDER_FIELDS as readonly string[]).includes(match[1])) return false;
    starts.add(match.index);
    ends.add(match.index + match[0].length);
  }
  for (let i = body.indexOf("{{"); i !== -1; i = body.indexOf("{{", i + 1)) if (!starts.has(i)) return false;
  for (let i = body.indexOf("}}"); i !== -1; i = body.indexOf("}}", i + 1)) if (!ends.has(i + 2)) return false;
  return true;
}

const templateInputSchema = z.object({
  documentTypeId: z.string().uuid(),
  layoutKey: z.enum(LAYOUT_KEYS),
  title: z.string().trim().min(1, "Document title is required.").max(200),
  body: z.string().trim().min(1, "Body text is required.").max(4000).refine(validPlaceholders, placeholderMessage),
  principalTitle: z.string().trim().max(120),
  registrarTitle: z.string().trim().max(120),
});

export type DocumentTypeTemplateView = {
  documentTypeId: string;
  documentTypeName: string;
  layoutKey: CertTemplateKey;
  wording: TemplateWording;
  isCustomized: boolean;
};

function toView(
  documentType: { id: string; name: string },
  row?: typeof documentTypeTemplates.$inferSelect,
): DocumentTypeTemplateView {
  const defaults = defaultDocumentTypeTemplate(documentType.name);
  const customized = Boolean(
    row &&
      (row.layoutKey !== defaults.layoutKey ||
        row.title !== defaults.title ||
        row.body !== defaults.body ||
        row.principalTitle !== defaults.principalTitle ||
        row.registrarTitle !== defaults.registrarTitle),
  );
  return {
    documentTypeId: documentType.id,
    documentTypeName: documentType.name,
    layoutKey: (row?.layoutKey as CertTemplateKey | undefined) ?? "enrolment-jhs",
    wording: row
      ? {
          title: row.title,
          body: row.body,
          principalTitle: row.principalTitle,
          registrarTitle: row.registrarTitle || null,
        }
      : {
          title: defaults.title,
          body: defaults.body,
          principalTitle: defaults.principalTitle,
          registrarTitle: defaults.registrarTitle || null,
        },
    isCustomized: customized,
  };
}

export async function listDocumentTypeTemplates(): Promise<DocumentTypeTemplateView[]> {
  const [types, rows] = await Promise.all([
    getDb().select({ id: documentTypes.id, name: documentTypes.name }).from(documentTypes).orderBy(documentTypes.name),
    getDb().select().from(documentTypeTemplates),
  ]);
  const byId = new Map(rows.map((row) => [row.documentTypeId, row]));
  return types.map((type) => toView(type, byId.get(type.id)));
}

export async function getDocumentTypeTemplate(documentTypeId: string) {
  const [documentType] = await getDb()
    .select({ id: documentTypes.id, name: documentTypes.name })
    .from(documentTypes)
    .where(eq(documentTypes.id, documentTypeId))
    .limit(1);
  if (!documentType) return null;
  const [row] = await getDb()
    .select()
    .from(documentTypeTemplates)
    .where(eq(documentTypeTemplates.documentTypeId, documentTypeId))
    .limit(1);
  if (!row) return null;
  return {
    ...toView(documentType, row),
    wording: {
      title: row.title,
      body: row.body,
      principalTitle: row.principalTitle,
      registrarTitle: row.registrarTitle || null,
    },
  };
}

export async function saveDocumentTypeTemplate(input: unknown): Promise<DocumentTypeTemplateView> {
  const values = templateInputSchema.parse(input);
  await assertBodyFits(values.layoutKey, values.body);
  const [documentType] = await getDb()
    .select({ id: documentTypes.id, name: documentTypes.name })
    .from(documentTypes)
    .where(eq(documentTypes.id, values.documentTypeId))
    .limit(1);
  if (!documentType) throw new AppError("Document type not found.", 404);
  const [row] = await getDb()
    .insert(documentTypeTemplates)
    .values({ ...values, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: documentTypeTemplates.documentTypeId,
      set: {
        layoutKey: values.layoutKey,
        title: values.title,
        body: values.body,
        principalTitle: values.principalTitle,
        registrarTitle: values.registrarTitle,
        updatedAt: new Date(),
      },
    })
    .returning();
  return toView(documentType, row);
}

export async function resetDocumentTypeTemplate(documentTypeId: string) {
  const [documentType] = await getDb()
    .select({ id: documentTypes.id, name: documentTypes.name })
    .from(documentTypes)
    .where(eq(documentTypes.id, documentTypeId))
    .limit(1);
  if (!documentType) throw new AppError("Document type not found.", 404);
  const [row] = await getDb()
    .insert(documentTypeTemplates)
    .values({ documentTypeId, ...defaultDocumentTypeTemplate(documentType.name), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: documentTypeTemplates.documentTypeId,
      set: { ...defaultDocumentTypeTemplate(documentType.name), updatedAt: new Date() },
    })
    .returning();
  return toView(documentType, row);
}
