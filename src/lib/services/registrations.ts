import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { sendRegistrationDecisionEmail } from "@/lib/email";
import type { PendingRegistrationView, RegistrationStatus } from "@/lib/types";
import { AppError } from "@/lib/utils";
import { recordAuditedAction } from "@/lib/services/audit-log";
import { notifyRegistrationDecision } from "@/lib/services/notifications";

export async function listPendingRegistrations(): Promise<PendingRegistrationView[]> {
  const rows = await getDb()
    .select({
      id: users.id,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      email: users.email,
      lrn: users.lrn,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.role, "student"), eq(users.registrationStatus, "pending")))
    .orderBy(asc(users.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" "),
    email: row.email,
    lrn: row.lrn ?? "",
    createdAt: row.createdAt.toISOString(),
  }));
}

type DecideRegistrationInput = {
  id: string;
  decision: "approved" | "declined";
  note: string;
  actorUserId: string;
  actorRole: UserRole;
};

type DecisionEffects = {
  writeAudit?: typeof recordAuditedAction;
  sendEmail?: typeof sendRegistrationDecisionEmail;
  notifyStudent?: typeof notifyRegistrationDecision;
};

export async function decideRegistration(
  input: DecideRegistrationInput,
  effects: DecisionEffects = {},
): Promise<RegistrationStatus> {
  const note = input.note.trim();
  if (!note) throw new AppError("A note is required.", 400);

  const db = getDb();
  const [student] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
  if (!student || student.role !== "student") {
    throw new AppError("Registration not found.", 404);
  }

  const canDecidePending = student.registrationStatus === "pending";
  const canRestoreDeclined = student.registrationStatus === "declined" && input.decision === "approved";
  if (!canDecidePending && !canRestoreDeclined) {
    throw new AppError("This registration has already been reviewed.", 409);
  }

  const [updated] = await db
    .update(users)
    .set({
      registrationStatus: input.decision,
      tokenVersion: student.tokenVersion + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, student.id), eq(users.registrationStatus, student.registrationStatus)))
    .returning({ registrationStatus: users.registrationStatus });

  if (!updated) throw new AppError("This registration changed while it was being reviewed. Refresh and try again.", 409);

  const action = `registration.${input.decision}`;
  await (effects.writeAudit ?? recordAuditedAction)({
    referenceType: "registration",
    referenceId: student.id,
    action,
    actorRole: input.actorRole,
    entityType: "registration",
    entityId: student.id,
    actorUserId: input.actorUserId,
    description: note,
    metadata: { decision: input.decision, note },
    hashMetadata: { decision: input.decision, note },
  });

  const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
  try {
    const result = await (effects.sendEmail ?? sendRegistrationDecisionEmail)({
      to: student.email,
      studentName,
      decision: input.decision,
      note,
    });
    if (!result.ok) console.warn("[registrations] Decision email was not sent:", result.reason ?? "unknown reason");
  } catch (error) {
    console.warn("[registrations] Decision email failed:", error instanceof Error ? error.message : "unknown error");
  }

  try {
    await (effects.notifyStudent ?? notifyRegistrationDecision)({
      userId: student.id,
      studentName,
      decision: input.decision,
    });
  } catch (error) {
    console.warn("[registrations] Student notification failed:", error instanceof Error ? error.message : "unknown error");
  }

  return updated.registrationStatus;
}
