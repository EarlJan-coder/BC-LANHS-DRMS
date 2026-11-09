import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documentTypes } from "@/db/schema";
import type { DocumentTypeView } from "@/lib/types";
import { documentTypeMutationSchema } from "@/lib/validators";
import { AppError } from "@/lib/utils";

function toView(row: typeof documentTypes.$inferSelect): DocumentTypeView {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
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

async function assertUnique(name: string, code: string, exceptId?: string) {
  const existing = await getDb().query.documentTypes.findMany();
  const collision = existing.find(
    (row) => row.id !== exceptId && (row.name.toLowerCase() === name.toLowerCase() || row.code.toLowerCase() === code.toLowerCase()),
  );
  if (!collision) return;
  if (collision.name.toLowerCase() === name.toLowerCase()) throw new AppError("A document type with this name already exists.", 409);
  throw new AppError("A document type with this code already exists.", 409);
}

export async function createDocumentType(input: unknown): Promise<DocumentTypeView> {
  const values = documentTypeMutationSchema.parse(input);
  await assertUnique(values.name, values.code);
  try {
    const [created] = await getDb()
      .insert(documentTypes)
      .values({
        name: values.name,
        code: values.code,
        description: values.description,
        requirements: values.requirements,
        processingDays: values.processingDays,
        fee: values.fee.toFixed(2),
        isActive: values.isActive,
      })
      .returning();
    return toView(created);
  } catch (error) {
    if (databaseCode(error) === "23505") throw new AppError("A document type with this name or code already exists.", 409);
    throw error;
  }
}

export async function updateDocumentType(id: string, input: unknown): Promise<DocumentTypeView> {
  const values = documentTypeMutationSchema.parse(input);
  await assertUnique(values.name, values.code, id);
  try {
    const [updated] = await getDb()
      .update(documentTypes)
      .set({
        name: values.name,
        code: values.code,
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
    if (databaseCode(error) === "23505") throw new AppError("A document type with this name or code already exists.", 409);
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
