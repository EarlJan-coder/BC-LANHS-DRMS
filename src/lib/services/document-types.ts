import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documentRequests, documentTypeTemplates, documentTypes } from "@/db/schema";
import { defaultDocumentTypeTemplate } from "@/lib/services/document-type-templates";
import type { DocumentTypeView } from "@/lib/types";
import { documentTypeMutationSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

function toView(row: typeof documentTypes.$inferSelect): DocumentTypeView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    requirements: row.requirements,
    processingDays: row.processingDays,
    fee: Number(row.fee),
    isActive: row.isActive,
    status: row.isActive ? "Active" : "Inactive",
  };
}

function databaseCode(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error) return String((error as { code?: unknown }).code ?? "");
  if ("cause" in error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause) {
    return String((error.cause as { code?: unknown }).code ?? "");
  }
  return undefined;
}

async function assertUnique(name: string, exceptId?: string) {
  const existing = await getDb().query.documentTypes.findMany();
  const collision = existing.find(
    (row) => row.id !== exceptId && row.name.toLowerCase() === name.toLowerCase(),
  );
  if (!collision) return;
  if (collision.name.toLowerCase() === name.toLowerCase()) throw new AppError("A document type with this name already exists.", 409);
}

export async function createDocumentType(input: unknown): Promise<DocumentTypeView> {
  const values = documentTypeMutationSchema.parse(input);
  await assertUnique(values.name);
  try {
    const db = getDb();
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(documentTypes)
        .values({
          name: values.name,
          description: values.description,
          requirements: values.requirements,
          processingDays: values.processingDays,
          fee: values.fee.toFixed(2),
          isActive: values.isActive,
        })
        .returning();
      await tx.insert(documentTypeTemplates).values({
        documentTypeId: row.id,
        ...defaultDocumentTypeTemplate(row.name),
      });
      return row;
    });
    return toView(created);
  } catch (error) {
    if (databaseCode(error) === "23505") throw new AppError("A document type with this name already exists.", 409);
    throw error;
  }
}

export async function updateDocumentType(id: string, input: unknown): Promise<DocumentTypeView> {
  const values = documentTypeMutationSchema.parse(input);
  await assertUnique(values.name, id);
  try {
    const [updated] = await getDb()
      .update(documentTypes)
      .set({
        name: values.name,
        description: values.description,
        requirements: values.requirements,
        processingDays: values.processingDays,
        fee: values.fee.toFixed(2),
        isActive: values.isActive,
        updatedAt: new Date(),
      })
      .where(eq(documentTypes.id, id))
      .returning();
    if (!updated) throw new AppError("Document type not found.", 404);
    return toView(updated);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (databaseCode(error) === "23505") throw new AppError("A document type with this name already exists.", 409);
    throw error;
  }
}

export async function deactivateDocumentType(id: string): Promise<void> {
  const [updated] = await getDb()
    .update(documentTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(documentTypes.id, id))
    .returning({ id: documentTypes.id });
  if (!updated) throw new AppError("Document type not found.", 404);
}

export async function deleteDocumentType(id: string): Promise<void> {
  const db = getDb();
  const [linkedRequests] = await db
    .select({ value: count() })
    .from(documentRequests)
    .where(eq(documentRequests.documentTypeId, id));

  if (Number(linkedRequests?.value ?? 0) > 0) {
    throw new AppError("This document type has linked requests and cannot be deleted. Deactivate it instead.", 409);
  }

  try {
    const [deleted] = await db.delete(documentTypes).where(eq(documentTypes.id, id)).returning({ id: documentTypes.id });
    if (!deleted) throw new AppError("Document type not found.", 404);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (databaseCode(error) === "23503") {
      throw new AppError("This document type has linked requests and cannot be deleted. Deactivate it instead.", 409);
    }
    throw error;
  }
}
