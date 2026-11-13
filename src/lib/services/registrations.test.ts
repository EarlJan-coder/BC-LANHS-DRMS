import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { AuditedActionInput } from "@/lib/services/audit-log";
import type { UserRole } from "@/db/schema";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { eq, inArray, or } = await import("drizzle-orm");
const { getDb, closeDb } = await import("@/db");
const { notifications, students, users } = await import("@/db/schema");
const { buildRegistrationDecisionEmailContent } = await import("@/lib/email");
const { decideRegistration, listPendingRegistrations } = await import("@/lib/services/registrations");
const { fanOutNewRegistrationNotification } = await import("@/lib/services/notifications");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

async function createUser(role: "student" | "registrar" | "admin", registrationStatus: "pending" | "approved" | "declined" = "pending") {
  fixtureIndex += 1;
  const id = randomUUID();
  const [user] = await getDb()
    .insert(users)
    .values({
      id,
      email: `registration-${Date.now()}-${fixtureIndex}@example.test`,
      passwordHash: "test-password-hash",
      firstName: "Riley",
      middleName: "Mae",
      lastName: "Santos",
      role,
      registrationStatus,
    })
    .returning();
  return user;
}

async function cleanup(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  await db.delete(notifications).where(
    or(inArray(notifications.userId, ids), inArray(notifications.referenceId, ids)),
  );
  await db.delete(users).where(inArray(users.id, ids));
}

const noopAudit = async () => ({
  recordHash: "0x0",
  blockchainStatus: "blockchain_pending" as const,
  blockchainTransactionHash: null,
  blockchainError: null,
  blockNumber: null,
  network: null,
});

async function decide(
  studentId: string,
  actor: { id: string; role: UserRole },
  decision: "approved" | "declined",
  note = "Verified the registration details.",
  effects: Parameters<typeof decideRegistration>[1] = {},
) {
  return decideRegistration({
    id: studentId,
    decision,
    note,
    actorUserId: actor.id,
    actorRole: actor.role,
  }, { writeAudit: noopAudit, ...effects });
}

describe("registration decisions and fan-out (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("approve sets registrationStatus to approved", async () => {
    const student = await createUser("student");
    const actor = await createUser("registrar", "approved");
    try {
      const status = await decide(student.id, actor, "approved", "Verified the registration details.", {
        sendEmail: async () => ({ ok: true }),
      });
      assert.equal(status, "approved");
      assert.equal((await getDb().query.users.findFirst({ where: eq(users.id, student.id) }))?.registrationStatus, "approved");
    } finally {
      await cleanup([student.id, actor.id]);
    }
  });

  it("decline sets registrationStatus to declined and includes the note in the email copy", async () => {
    const student = await createUser("student");
    const actor = await createUser("admin", "approved");
    const note = "Please correct the LRN on your registration.";
    let sentNote = "";
    try {
      const status = await decide(student.id, actor, "declined", note, {
        sendEmail: async (input) => {
          sentNote = input.note;
          return { ok: true };
        },
      });
      assert.equal(status, "declined");
      assert.equal(sentNote, note);
      const email = buildRegistrationDecisionEmailContent({
        studentName: "Riley Mae Santos",
        decision: "declined",
        note,
      });
      assert.match(email.message, new RegExp(note));
      assert.match(email.subject, /declined/i);
    } finally {
      await cleanup([student.id, actor.id]);
    }
  });

  it("a decision can be made without a note", async () => {
    const student = await createUser("student");
    const actor = await createUser("registrar", "approved");
    try {
      const status = await decide(student.id, actor, "declined", "   ", {
        sendEmail: async () => ({ ok: true }),
      });
      assert.equal(status, "declined");
      assert.equal(
        (await getDb().query.users.findFirst({ where: eq(users.id, student.id) }))?.registrationStatus,
        "declined",
      );
      const email = buildRegistrationDecisionEmailContent({
        studentName: "Riley Mae Santos",
        decision: "declined",
        note: "",
      });
      assert.doesNotMatch(email.message, /Registrar note/i);
      assert.match(email.message, /contact the registrar/i);
    } finally {
      await cleanup([student.id, actor.id]);
    }
  });

  it("a declined registration can later be approved", async () => {
    const student = await createUser("student");
    const actor = await createUser("registrar", "approved");
    const effects = { sendEmail: async () => ({ ok: true }) };
    try {
      assert.equal(await decide(student.id, actor, "declined", "Needs a corrected email.", effects), "declined");
      assert.equal(await decide(student.id, actor, "approved", "The record has been corrected.", effects), "approved");
    } finally {
      await cleanup([student.id, actor.id]);
    }
  });

  it("decision writes an audit log entry with the note and actor", async () => {
    const student = await createUser("student");
    const actor = await createUser("admin", "approved");
    let auditEntry: AuditedActionInput | undefined;
    try {
      await decide(student.id, actor, "declined", "Needs registrar review.", {
        sendEmail: async () => ({ ok: true }),
        writeAudit: async (input) => {
          auditEntry = input;
          return noopAudit();
        },
      });
      assert.ok(auditEntry);
      assert.equal(auditEntry.action, "registration.declined");
      assert.equal(auditEntry.actorUserId, actor.id);
      assert.equal(auditEntry.entityId, student.id);
      assert.equal(auditEntry.description, "Needs registrar review.");
    } finally {
      await cleanup([student.id, actor.id]);
    }
  });

  it("new registration notifies every active registrar and admin regardless of registration status", async () => {
    const student = await createUser("student");
    const registrar = await createUser("registrar", "approved");
    const admin = await createUser("admin", "approved");
    const pendingRegistrar = await createUser("registrar", "pending");
    const ids = [student.id, registrar.id, admin.id, pendingRegistrar.id];
    try {
      const created = await fanOutNewRegistrationNotification("Riley Mae Santos", student.email);
      const recipients = created.map((row) => row.userId).filter((id): id is string => id !== null);
      assert.ok(recipients.includes(registrar.id));
      assert.ok(recipients.includes(admin.id));
      assert.ok(recipients.includes(pendingRegistrar.id));

      const fixtureRows = await getDb()
        .select()
        .from(notifications)
        .where(inArray(notifications.userId, ids));
      assert.deepEqual(
        fixtureRows.map((row) => row.userId).sort(),
        [registrar.id, admin.id, pendingRegistrar.id].sort(),
      );
      assert.ok(fixtureRows.every((row) => row.referenceType === "registration" && row.referenceId === student.id));
      assert.ok(fixtureRows.every((row) => row.message === "Registration · Pending"));
    } finally {
      await cleanup(ids);
    }
  });

  it("a failed email send does not fail the decision", async () => {
    const student = await createUser("student");
    const actor = await createUser("registrar", "approved");
    try {
      const status = await decide(student.id, actor, "declined", "Please verify your details.", {
        sendEmail: async () => ({ ok: false, reason: "provider unavailable" }),
      });
      assert.equal(status, "declined");
    } finally {
      await cleanup([student.id, actor.id]);
    }
  });
});

describe("listPendingRegistrations (integration, local DB)", { skip: hasDb ? false : "DATABASE_URL not configured" }, () => {
  it("shows the LRN and last school year attended for each pending registration", async () => {
    const fromStudentRecord = await createUser("student");
    const fromUserLrnOnly = await createUser("student");
    const bare = await createUser("student");
    const studentLrn = "310000000001";
    try {
      await getDb()
        .insert(students)
        .values({
          userId: fromStudentRecord.id,
          lrn: studentLrn,
          firstName: "Riley",
          lastName: "Santos",
          lastSchoolYearAttended: "2025-2026",
        });
      await getDb().update(users).set({ lrn: "310000000002" }).where(eq(users.id, fromUserLrnOnly.id));

      const rows = await listPendingRegistrations();

      const withRecord = rows.find((row) => row.id === fromStudentRecord.id);
      assert.ok(withRecord);
      assert.equal(withRecord.lrn, studentLrn);
      assert.equal(withRecord.lastSchoolYearAttended, "2025-2026");

      const withUserLrn = rows.find((row) => row.id === fromUserLrnOnly.id);
      assert.ok(withUserLrn);
      assert.equal(withUserLrn.lrn, "310000000002");
      assert.equal(withUserLrn.lastSchoolYearAttended, "Not set");

      const withoutDetails = rows.find((row) => row.id === bare.id);
      assert.ok(withoutDetails);
      assert.equal(withoutDetails.lrn, "Not set");
      assert.equal(withoutDetails.lastSchoolYearAttended, "Not set");
    } finally {
      await getDb()
        .delete(students)
        .where(inArray(students.userId, [fromStudentRecord.id, fromUserLrnOnly.id, bare.id]));
      await cleanup([fromStudentRecord.id, fromUserLrnOnly.id, bare.id]);
    }
  });

  it("lists a registration once even when the account has several student records", async () => {
    const student = await createUser("student");
    try {
      await getDb()
        .insert(students)
        .values([
          {
            userId: student.id,
            lrn: "310000000003",
            firstName: "Riley",
            lastName: "Santos",
            lastSchoolYearAttended: "2024-2025",
            createdAt: new Date("2024-06-01T00:00:00Z"),
          },
          {
            userId: student.id,
            lrn: "310000000004",
            firstName: "Riley",
            lastName: "Santos",
            lastSchoolYearAttended: "2025-2026",
            createdAt: new Date("2025-06-01T00:00:00Z"),
          },
        ]);

      const rows = await listPendingRegistrations();
      const matches = rows.filter((row) => row.id === student.id);
      assert.equal(matches.length, 1);
      assert.equal(matches[0]?.lastSchoolYearAttended, "2024-2025");
    } finally {
      await getDb().delete(students).where(inArray(students.userId, [student.id]));
      await cleanup([student.id]);
    }
  });
});
