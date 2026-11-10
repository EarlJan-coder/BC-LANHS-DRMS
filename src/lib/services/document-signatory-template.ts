import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documentSignatoryTemplate } from "@/db/schema";
import { z } from "zod";

export const documentSignatoryTemplateSchema = z.object({
  registrarName: z.string().trim().max(200, "Registrar name must be 200 characters or fewer."),
  principalName: z.string().trim().max(200, "Principal name must be 200 characters or fewer."),
});

export type DocumentSignatoryTemplate = z.infer<typeof documentSignatoryTemplateSchema>;

export async function getDocumentSignatoryTemplate(): Promise<DocumentSignatoryTemplate> {
  const [row] = await getDb().select().from(documentSignatoryTemplate).where(eq(documentSignatoryTemplate.id, 1)).limit(1);
  return { registrarName: row?.registrarName ?? "", principalName: row?.principalName ?? "" };
}

export async function saveDocumentSignatoryTemplate(input: unknown): Promise<DocumentSignatoryTemplate> {
  const values = documentSignatoryTemplateSchema.parse(input);
  const [row] = await getDb()
    .insert(documentSignatoryTemplate)
    .values({ id: 1, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({ target: documentSignatoryTemplate.id, set: { ...values, updatedAt: new Date() } })
    .returning();
  return { registrarName: row.registrarName, principalName: row.principalName };
}
